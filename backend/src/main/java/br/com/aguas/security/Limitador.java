package br.com.aguas.security;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;

/** Conta as requisições de cada chave (IP ou usuário) e recusa o que passar do limite por minuto. */
class Limitador {

    /** Teto de chaves na memória, para muitos IPs diferentes não esgotarem a memória da API. */
    static final int MAX_CHAVES = 10_000;

    private static final Duration JANELA = Duration.ofMinutes(1);

    /** ultimoUso é AtomicLong: várias requisições da mesma chave podem atualizar ao mesmo tempo. */
    private record Entrada(Bucket balde, AtomicLong ultimoUso) {}

    private final Map<String, Entrada> entradas = new ConcurrentHashMap<>();
    private final int porMinuto;
    private final LongSupplier relogioNanos;

    Limitador(int porMinuto) {
        this(porMinuto, System::nanoTime);
    }

    Limitador(int porMinuto, LongSupplier relogioNanos) {
        this.porMinuto = porMinuto;
        this.relogioNanos = relogioNanos;
    }

    /** Chave do balde dividido pelas chaves novas quando a memória está cheia de chaves em uso. */
    static final String EXCESSO = "\u0000excesso";

    /** Devolve 0 se a requisição pode seguir; senão, quantos segundos esperar (pelo menos 1). */
    long consumir(String chave) {
        if (entradas.size() >= MAX_CHAVES && !entradas.containsKey(chave)) {
            limpar();
            // Continua cheio: todas as chaves foram usadas no último minuto. As novas dividem um balde só,
            // em vez de apagar os limites de quem já está na memória. Apagar deixaria um ataque com muitos
            // IPs zerar o limite de todo mundo, inclusive o próprio.
            if (entradas.size() >= MAX_CHAVES) chave = EXCESSO;
        }
        Entrada entrada = entradas.computeIfAbsent(chave, c -> new Entrada(novoBalde(), new AtomicLong()));
        entrada.ultimoUso().set(relogioNanos.getAsLong());
        var resultado = entrada.balde().tryConsumeAndReturnRemaining(1);
        if (resultado.isConsumed()) return 0;
        return Math.max(1, Duration.ofNanos(resultado.getNanosToWaitForRefill()).toSeconds() + 1);
    }

    int chavesNaMemoria() {
        return entradas.size();
    }

    /** Quem ficou mais de uma janela sem usar já recuperou todo o limite e pode sair da memória. */
    private void limpar() {
        long agora = relogioNanos.getAsLong();
        entradas.values().removeIf(e -> agora - e.ultimoUso().get() > JANELA.toNanos());
    }

    private Bucket novoBalde() {
        Bandwidth limite = Bandwidth.builder().capacity(porMinuto).refillIntervally(porMinuto, JANELA).build();
        return Bucket.builder().addLimit(limite).withCustomTimePrecision(new TimeMeter() {
            @Override
            public long currentTimeNanos() {
                return relogioNanos.getAsLong();
            }

            @Override
            public boolean isWallClockBased() {
                return false;
            }
        }).build();
    }
}
