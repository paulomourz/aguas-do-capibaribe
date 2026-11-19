package br.com.aguas.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import com.sun.net.httpserver.HttpServer;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;

/**
 * Disjuntor (circuit breaker) das chamadas à Bot API do Telegram.
 *
 * Critério: passando de 50% de falhas nas requisições HTTP, o disjuntor abre e as chamadas seguintes voltam
 * na hora, sem esperar o tempo limite da rede — o aviso segue para a fila local de pendentes.
 *
 * Os testes usam um Telegram de mentira num servidor local (sem rede externa e sem Spring), que conta
 * quantas requisições chegaram de verdade: é essa contagem que mostra que o disjuntor aberto não chama nada.
 */
class DisjuntorDoTelegramTest {

    /** Janela de 10 chamadas, a partir de 5, abrindo acima de 50% de falhas (os padrões). */
    static final DisjuntorProperties PADROES = new DisjuntorProperties(null, null, null, null);

    /** Quantas falhas seguidas bastam para a porcentagem ser calculada e passar de 50%. */
    static final int FALHAS_ATE_ABRIR = DisjuntorProperties.MINIMO_CHAMADAS_PADRAO;

    HttpServer servidor;
    final AtomicInteger requisicoes = new AtomicInteger();
    volatile int status = 500;
    volatile long atrasoMs = 0;

    CircuitBreaker disjuntor;
    Telegram telegram;

    @BeforeEach
    void subirTelegramDeMentira() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        servidor.createContext("/", troca -> {
            requisicoes.incrementAndGet();
            troca.getRequestBody().readAllBytes();
            dormir(atrasoMs);
            troca.sendResponseHeaders(status, -1);
            troca.close();
        });
        servidor.start();

        var props = new TelegramProperties("token-de-teste", "1",
                "http://localhost:" + servidor.getAddress().getPort(), null, null, null, null);
        disjuntor = NotificacaoConfig.disjuntor(PADROES);
        telegram = new Telegram(props, RestClient.builder(), disjuntor);
    }

    @AfterEach
    void derrubarTelegramDeMentira() {
        servidor.stop(0);
    }

    private static void dormir(long ms) {
        if (ms <= 0) return;
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Tenta enviar n vezes, engolindo as falhas do Telegram (não as recusas do disjuntor). */
    private void enviarIgnorandoFalhas(int n) {
        for (int i = 0; i < n; i++) {
            try {
                telegram.enviar("mensagem de teste");
            } catch (CallNotPermittedException e) {
                throw e;
            } catch (RuntimeException e) {
                // Falha esperada do Telegram de mentira.
            }
        }
    }

    // ---------- abre passando de 50% ----------

    @Test
    void comTodasAsRequisicoesFalhandoODisjuntorAbre() {
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);

        assertThat(requisicoes).hasValue(FALHAS_ATE_ABRIR);
        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.OPEN);
    }

    @Test
    void poucasFalhasNaoAbremODisjuntor() {
        // Abaixo do mínimo de chamadas, a porcentagem nem é calculada: duas quedas isoladas não cortam os avisos.
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR - 1);

        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void metadeDeFalhasNaoBastaPrecisaPassarDe50PorCento() {
        // 5 falhas e 5 sucessos intercalados: exatamente 50%, que não passa do limite.
        for (int i = 0; i < DisjuntorProperties.JANELA_PADRAO; i++) {
            status = i % 2 == 0 ? 500 : 200;
            enviarIgnorandoFalhas(1);
        }

        assertThat(disjuntor.getMetrics().getFailureRate()).isEqualTo(50f);
        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    // ---------- aberto, recusa na hora ----------

    @Test
    void abertoRecusaAChamadaSemTocarNaRede() {
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);
        int antes = requisicoes.get();

        assertThatThrownBy(() -> telegram.enviar("mensagem de teste"))
                .isInstanceOf(CallNotPermittedException.class);

        assertThat(requisicoes).hasValue(antes);
    }

    @Test
    void abertoVoltaNaHoraEmVezDeEsperarOTempoLimiteDaRede() {
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);
        // Agora o Telegram de mentira demora 2 s para responder: fosse chamada de verdade, a espera apareceria.
        atrasoMs = 2000;

        long inicio = System.nanoTime();
        assertThatThrownBy(() -> telegram.enviar("mensagem de teste"))
                .isInstanceOf(CallNotPermittedException.class);
        Duration gasto = Duration.ofNanos(System.nanoTime() - inicio);

        assertThat(gasto).isLessThan(Duration.ofSeconds(1));
    }

    // ---------- volta quando o Telegram volta ----------

    @Test
    void passadaAEsperaUmaChamadaDeTesteFechaODisjuntor() {
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);
        // O mesmo que o disjuntor faz sozinho depois de espera-aberto; aqui na mão, para o teste não depender do relógio.
        disjuntor.transitionToHalfOpenState();
        status = 200;

        assertThatCode(() -> telegram.enviar("mensagem de teste")).doesNotThrowAnyException();

        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void seOTelegramAindaEstiverForaAChamadaDeTesteAbreODisjuntorDeNovo() {
        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);
        disjuntor.transitionToHalfOpenState();

        enviarIgnorandoFalhas(1);

        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.OPEN);
    }

    // ---------- 4xx é recusa da nossa requisição, não queda do Telegram ----------

    @Test
    void tokenOuGrupoErradoNaoAbreODisjuntor() {
        // 401 (token errado) e 400 (id do grupo errado) não melhoram com espera, e abrir o disjuntor esconderia
        // o status HTTP que diz o que corrigir. O aviso vira pendente do mesmo jeito.
        status = 401;

        enviarIgnorandoFalhas(DisjuntorProperties.JANELA_PADRAO + 1);

        assertThat(requisicoes).hasValue(DisjuntorProperties.JANELA_PADRAO + 1);
        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void limiteDeEnviosDoTelegramAbreODisjuntor() {
        // 429: o Telegram está pedindo para a gente parar, e é disso que o disjuntor cuida.
        status = 429;

        enviarIgnorandoFalhas(FALHAS_ATE_ABRIR);

        assertThat(disjuntor.getState()).isEqualTo(CircuitBreaker.State.OPEN);
    }

    // ---------- configuração ----------

    @Test
    void disjuntorTemPadroesDeJanela10Minimo5E50PorCento() {
        assertThat(PADROES.janelaOuPadrao()).isEqualTo(10);
        assertThat(PADROES.minimoChamadasOuPadrao()).isEqualTo(5);
        assertThat(PADROES.limiteFalhasOuPadrao()).isEqualTo(50);
        // Menor que app.telegram.reenvio-a-cada (5 min), para cada rodada de reenvio testar o Telegram.
        assertThat(PADROES.esperaAbertoOuPadrao()).isEqualTo(Duration.ofMinutes(1))
                .isLessThan(TelegramProperties.REENVIO_A_CADA_PADRAO);
    }

    @Test
    void valoresDoApplicationYmlSubstituemOsPadroes() {
        var props = new DisjuntorProperties(20, 8, 70, Duration.ofSeconds(30));

        assertThat(props.janelaOuPadrao()).isEqualTo(20);
        assertThat(props.minimoChamadasOuPadrao()).isEqualTo(8);
        assertThat(props.limiteFalhasOuPadrao()).isEqualTo(70);
        assertThat(props.esperaAbertoOuPadrao()).isEqualTo(Duration.ofSeconds(30));
    }
}
