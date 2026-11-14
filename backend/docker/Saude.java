import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Healthcheck do contêiner da API. A imagem distroless não tem shell nem curl, então o Docker roda esta classe:
 * ela chama /api/actuator/health e sai com 0 se a API responder 200 (UP), ou 1 em qualquer outro caso.
 */
public class Saude {
    public static void main(String[] args) {
        try {
            HttpClient cliente = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
            HttpRequest pedido = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8080/api/actuator/health"))
                    .timeout(Duration.ofSeconds(3))
                    .build();
            int status = cliente.send(pedido, HttpResponse.BodyHandlers.discarding()).statusCode();
            System.exit(status == 200 ? 0 : 1);
        } catch (Exception e) {
            System.exit(1);
        }
    }
}
