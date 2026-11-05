package br.com.aguas.notificacao;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.telegram.*" do aviso de alerta. token e chatId vêm só de variável de ambiente
 * (TELEGRAM_TOKEN e TELEGRAM_CHAT_ID). Sem os dois, o aviso fica desligado.
 * siteUrl (SITE_URL) é opcional: com ele, a mensagem leva o link do alerta.
 */
@ConfigurationProperties("app.telegram")
public record TelegramProperties(String token, String chatId, String url, String siteUrl) {

    public boolean configurado() {
        return token != null && !token.isBlank() && chatId != null && !chatId.isBlank();
    }

    public String urlOuPadrao() {
        return url == null || url.isBlank() ? "https://api.telegram.org" : url.trim();
    }
}
