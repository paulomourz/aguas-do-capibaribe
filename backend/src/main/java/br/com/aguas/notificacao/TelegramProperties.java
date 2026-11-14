package br.com.aguas.notificacao;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.telegram.*" do aviso de alerta. token e chatId vêm só de variável de ambiente
 * (TELEGRAM_TOKEN e TELEGRAM_CHAT_ID). Sem os dois, o aviso fica desligado.
 * siteUrl (SITE_URL) é opcional: com ele, a mensagem leva o link do alerta.
 * esperaEntreTentativas é a primeira pausa antes de tentar de novo quando o envio falha (padrão: 1 segundo);
 * cada pausa seguinte é o dobro da anterior (AvisoDeAlerta).
 * reenvioACada é o intervalo da rotina que reenvia os avisos pendentes (padrão: 5 minutos) e reenvioLimite
 * é até quando ela insiste num aviso, contado de quando ele ficou pendente (padrão: 24 horas).
 */
@ConfigurationProperties("app.telegram")
public record TelegramProperties(String token, String chatId, String url, String siteUrl, Duration esperaEntreTentativas,
        Duration reenvioACada, Duration reenvioLimite) {

    static final Duration ESPERA_PADRAO = Duration.ofSeconds(1);
    /** Mesmo padrão do @Scheduled de ReenvioDeAvisos. */
    static final Duration REENVIO_A_CADA_PADRAO = Duration.ofMinutes(5);
    static final Duration REENVIO_LIMITE_PADRAO = Duration.ofHours(24);

    public boolean configurado() {
        return token != null && !token.isBlank() && chatId != null && !chatId.isBlank();
    }

    public String urlOuPadrao() {
        return url == null || url.isBlank() ? "https://api.telegram.org" : url.trim();
    }

    public Duration esperaOuPadrao() {
        return esperaEntreTentativas == null ? ESPERA_PADRAO : esperaEntreTentativas;
    }

    public Duration reenvioACadaOuPadrao() {
        return reenvioACada == null ? REENVIO_A_CADA_PADRAO : reenvioACada;
    }

    public Duration reenvioLimiteOuPadrao() {
        return reenvioLimite == null ? REENVIO_LIMITE_PADRAO : reenvioLimite;
    }
}
