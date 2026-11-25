package br.com.aguas.notificacao;

import java.time.Duration;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;

/**
 * Envia uma mensagem de texto pela Bot API do Telegram (HTTPS, porta 443).
 *
 * Toda chamada passa por um disjuntor (circuit breaker). Enquanto o Telegram responde, ele não muda nada.
 * Quando a maioria das chamadas recentes falha, o disjuntor abre e as seguintes são recusadas na hora, com
 * {@link CallNotPermittedException}: a API não abre conexão nem espera o tempo limite da rede (5 s para
 * conectar e 10 s para a resposta), e quem chamou manda o aviso direto para a fila local de pendentes.
 * Ver {@link DisjuntorProperties}.
 */
@Component
public class Telegram {

    private final TelegramProperties props;
    private final RestClient http;
    private final CircuitBreaker disjuntor;

    @Autowired
    public Telegram(TelegramProperties props, RestClient.Builder builder, CircuitBreaker disjuntor) {
        this.props = props;
        this.disjuntor = disjuntor;
        var fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(Duration.ofSeconds(5));
        fabrica.setReadTimeout(Duration.ofSeconds(10));
        this.http = builder.baseUrl(props.urlOuPadrao()).requestFactory(fabrica).build();
    }

    /** Para os testes: disjuntor próprio, com os valores padrão. */
    Telegram(TelegramProperties props, RestClient.Builder builder) {
        this(props, builder, NotificacaoConfig.disjuntor(new DisjuntorProperties(null, null, null, null)));
    }

    public boolean configurado() {
        return props.configurado();
    }

    /**
     * Lança exceção se o Telegram recusar, não responder ou se o disjuntor estiver aberto
     * ({@link CallNotPermittedException}, sem nenhuma chamada de rede). A mensagem da exceção pode conter o token.
     */
    public void enviar(String texto) {
        disjuntor.executeRunnable(() -> postar(texto));
    }

    private void postar(String texto) {
        http.post()
                .uri("/bot{token}/sendMessage", props.token().trim())
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("chat_id", props.chatId().trim(), "text", texto, "disable_web_page_preview", true))
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * Erros que o disjuntor não conta como falha do Telegram: respostas 4xx, que são recusa da nossa
     * requisição (token errado, 401; id do grupo errado, 400) e não vão melhorar se esperarmos. Tentar de novo
     * não resolve, mas abrir o disjuntor também não: o aviso vai para os pendentes do mesmo jeito, e deixar o
     * disjuntor fechado mantém o log mostrando o status HTTP que diz o que corrigir.
     *
     * As exceções são 408 (tempo esgotado) e 429 (limite de envios): nesses dois o Telegram está em apuros, e é
     * exatamente aí que parar de insistir ajuda.
     */
    static boolean recusaDaNossaRequisicao(Throwable e) {
        if (!(e instanceof RestClientResponseException resposta)) return false;
        int status = resposta.getStatusCode().value();
        return resposta.getStatusCode().is4xxClientError()
                && status != HttpStatus.REQUEST_TIMEOUT.value()
                && status != HttpStatus.TOO_MANY_REQUESTS.value();
    }
}
