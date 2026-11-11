package br.com.aguas.notificacao;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.telegram.*" do aviso de alerta. token e chatId vêm só de variável de ambiente
 * (TELEGRAM_TOKEN e TELEGRAM_CHAT_ID). Sem os dois, o aviso fica desligado.
 * siteUrl (SITE_URL) é opcional: com ele, a mensagem leva o link do alerta.
 * esperaEntreTentativas é a pausa antes de tentar de novo quando o envio falha (padrão: 2 segundos).
 */
@ConfigurationProperties("app.telegram")
public record TelegramProperties(String token, String chatId, String url, String siteUrl, Duration esperaEntreTentativas) {

    static final Duration ESPERA_PADRAO = Duration.ofSeconds(2);

    public boolean configurado() {
        return token != null && !token.isBlank() && chatId != null && !chatId.isBlank();
    }

    public String urlOuPadrao() {
        return url == null || url.isBlank() ? "https://api.telegram.org" : url.trim();
    }

    public Duration esperaOuPadrao() {
        return esperaEntreTentativas == null ? ESPERA_PADRAO : esperaEntreTentativas;
    }
}
