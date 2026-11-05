package br.com.aguas.integracao;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import com.sun.net.httpserver.HttpServer;

/** Servidor HTTP local no lugar da Bot API do Telegram: guarda o que a API enviou e responde com o status escolhido. */
final class TelegramFalso {

    record Pedido(String caminho, String corpo) {}

    static final String TOKEN = "token-de-teste";
    static final List<Pedido> pedidos = new CopyOnWriteArrayList<>();
    static volatile int status = 200;

    private static final HttpServer servidor = iniciar();

    private TelegramFalso() {}

    static String url() {
        return "http://localhost:" + servidor.getAddress().getPort();
    }

    private static HttpServer iniciar() {
        try {
            HttpServer s = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            s.createContext("/", troca -> {
                pedidos.add(new Pedido(troca.getRequestURI().getPath(),
                        new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
                byte[] resposta = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                troca.sendResponseHeaders(status, resposta.length);
                troca.getResponseBody().write(resposta);
                troca.close();
            });
            s.start();
            return s;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
