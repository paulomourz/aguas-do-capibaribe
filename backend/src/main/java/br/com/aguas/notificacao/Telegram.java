package br.com.aguas.notificacao;

import java.time.Duration;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Envia uma mensagem de texto pela Bot API do Telegram (HTTPS, porta 443). */
@Component
public class Telegram {

    private final TelegramProperties props;
    private final RestClient http;

    public Telegram(TelegramProperties props, RestClient.Builder builder) {
        this.props = props;
        var fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(Duration.ofSeconds(5));
        fabrica.setReadTimeout(Duration.ofSeconds(10));
        this.http = builder.baseUrl(props.urlOuPadrao()).requestFactory(fabrica).build();
    }

    public boolean configurado() {
        return props.configurado();
    }

    /** Lança exceção se o Telegram recusar ou não responder. A mensagem da exceção pode conter o token. */
    public void enviar(String texto) {
        http.post()
                .uri("/bot{token}/sendMessage", props.token().trim())
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("chat_id", props.chatId().trim(), "text", texto, "disable_web_page_preview", true))
                .retrieve()
                .toBodilessEntity();
    }
}
