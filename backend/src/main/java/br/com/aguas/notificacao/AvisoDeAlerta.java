package br.com.aguas.notificacao;

import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClientResponseException;

/**
 * Avisa no Telegram quando um alerta é aberto. Roda depois do commit e em outra thread: o lote já está
 * gravado, a resposta ao operador não espera o envio, e uma falha aqui só vira uma linha no log.
 */
@Component
public class AvisoDeAlerta {

    private static final Logger log = LoggerFactory.getLogger(AvisoDeAlerta.class);

    private final Telegram telegram;
    private final TelegramProperties props;

    public AvisoDeAlerta(Telegram telegram, TelegramProperties props) {
        this.telegram = telegram;
        this.props = props;
    }

    @Async(NotificacaoConfig.EXECUTOR)
    @TransactionalEventListener
    public void aoAbrir(AlertaAberto alerta) {
        if (!telegram.configurado()) return;
        try {
            telegram.enviar(texto(alerta));
            log.info("Aviso do alerta {} enviado ao Telegram.", alerta.alertaId());
        } catch (RestClientResponseException e) {
            log.warn("Aviso do alerta {} recusado pelo Telegram: HTTP {}.", alerta.alertaId(), e.getStatusCode().value());
        } catch (RuntimeException e) {
            // Só o tipo do erro: a mensagem da exceção pode trazer a URL com o token.
            log.warn("Aviso do alerta {} não enviado ao Telegram: {}.", alerta.alertaId(), e.getClass().getSimpleName());
        }
    }

    String texto(AlertaAberto alerta) {
        String lotes = alerta.loteIds().stream().map(id -> "#" + id).collect(Collectors.joining(", "));
        String texto = "Alerta de consumo de água\n\n"
                + "Processo: " + alerta.processo() + "\n"
                + "3 lotes seguidos acima da meta: " + lotes + "\n"
                + "Alerta #" + alerta.alertaId() + " aberto.";
        String site = props.siteUrl();
        if (site != null && !site.isBlank()) {
            texto += "\n\nVer no sistema: " + site.trim().replaceAll("/+$", "") + "/#/alertas/" + alerta.alertaId();
        }
        return texto;
    }
}
