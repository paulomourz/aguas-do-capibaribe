package br.com.aguas.notificacao;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.telegram.disjuntor.*" do disjuntor (circuit breaker) dos envios ao Telegram.
 *
 * O disjuntor olha as últimas {@code janela} chamadas HTTP. Quando pelo menos {@code minimoChamadas} já
 * entraram nessa conta e mais de {@code limiteFalhas}% delas falharam, ele <b>abre</b>: durante
 * {@code esperaAberto}, toda chamada é recusada na hora, sem abrir conexão e sem esperar o tempo limite da
 * rede. Passada essa espera, ele deixa uma chamada passar para ver se o Telegram voltou (estado
 * "meio aberto"): se ela der certo, o disjuntor fecha; se falhar, abre de novo.
 *
 * A espera padrão (1 minuto) é bem menor que o intervalo do reenvio dos pendentes (5 minutos,
 * app.telegram.reenvio-a-cada), então cada rodada de reenvio já encontra o disjuntor pronto para testar o
 * Telegram de novo.
 */
@ConfigurationProperties("app.telegram.disjuntor")
public record DisjuntorProperties(Integer janela, Integer minimoChamadas, Integer limiteFalhas,
        Duration esperaAberto) {

    /** Últimas chamadas olhadas para calcular a porcentagem de falhas. */
    static final int JANELA_PADRAO = 10;

    /** Abaixo disso a porcentagem não é calculada: duas falhas seguidas não podem abrir o disjuntor. */
    static final int MINIMO_CHAMADAS_PADRAO = 5;

    /** Porcentagem de falhas na janela que abre o disjuntor (acima de 50%). */
    static final int LIMITE_FALHAS_PADRAO = 50;

    /** Quanto tempo o disjuntor fica aberto antes de deixar passar uma chamada de teste. */
    static final Duration ESPERA_ABERTO_PADRAO = Duration.ofMinutes(1);

    public int janelaOuPadrao() {
        return janela == null ? JANELA_PADRAO : janela;
    }

    public int minimoChamadasOuPadrao() {
        return minimoChamadas == null ? MINIMO_CHAMADAS_PADRAO : minimoChamadas;
    }

    public int limiteFalhasOuPadrao() {
        return limiteFalhas == null ? LIMITE_FALHAS_PADRAO : limiteFalhas;
    }

    public Duration esperaAbertoOuPadrao() {
        return esperaAberto == null ? ESPERA_ABERTO_PADRAO : esperaAberto;
    }
}
