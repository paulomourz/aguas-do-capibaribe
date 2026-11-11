package br.com.aguas.notificacao;

import java.time.Duration;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClientResponseException;

import br.com.aguas.entity.AvisoPendente;
import br.com.aguas.repository.AvisoPendenteRepository;

/**
 * Avisa no Telegram quando um alerta é aberto. Roda depois do commit e em outra thread: o lote já está
 * gravado e a resposta ao operador não espera o envio.
 *
 * Se o envio falhar (erro de rede, Telegram fora do ar ou recusando), a API tenta de novo, até 3 vezes
 * no total, com uma pausa entre as tentativas. Se a falha persistir, o aviso é gravado como pendente em
 * aviso_pendente. Nada disso sobe para quem registrou o lote.
 */
@Component
public class AvisoDeAlerta {

    /** Total de envios por aviso: o primeiro e mais duas novas tentativas. */
    static final int TENTATIVAS = 3;

    /** Pausa entre as tentativas; trocada nos testes para não esperar de verdade. */
    interface Pausa {
        void esperar(Duration tempo) throws InterruptedException;
    }

    private static final Logger log = LoggerFactory.getLogger(AvisoDeAlerta.class);

    private final Telegram telegram;
    private final TelegramProperties props;
    private final AvisoPendenteRepository pendentes;
    private final Pausa pausa;

    @Autowired
    public AvisoDeAlerta(Telegram telegram, TelegramProperties props, AvisoPendenteRepository pendentes) {
        this(telegram, props, pendentes, Thread::sleep);
    }

    AvisoDeAlerta(Telegram telegram, TelegramProperties props, AvisoPendenteRepository pendentes, Pausa pausa) {
        this.telegram = telegram;
        this.props = props;
        this.pendentes = pendentes;
        this.pausa = pausa;
    }

    @Async(NotificacaoConfig.EXECUTOR)
    @TransactionalEventListener
    public void aoAbrir(AlertaAberto alerta) {
        if (!telegram.configurado()) return;
        String texto = texto(alerta);
        String erro = "";
        int feitas = 0;
        while (feitas < TENTATIVAS) {
            feitas++;
            try {
                telegram.enviar(texto);
                log.info("Aviso do alerta {} enviado ao Telegram na tentativa {}.", alerta.alertaId(), feitas);
                return;
            } catch (RestClientResponseException e) {
                erro = "HTTP " + e.getStatusCode().value();
            } catch (RuntimeException e) {
                // Só o tipo do erro: a mensagem da exceção pode trazer a URL com o token.
                erro = e.getClass().getSimpleName();
            }
            log.warn("Aviso do alerta {}: tentativa {} de {} falhou ({}).", alerta.alertaId(), feitas, TENTATIVAS, erro);
            if (feitas < TENTATIVAS && !esperar()) break;
        }
        guardarPendente(alerta, feitas, erro);
    }

    /** Falso se a thread foi interrompida (a API está parando): não adianta tentar de novo. */
    private boolean esperar() {
        try {
            pausa.esperar(props.esperaOuPadrao());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void guardarPendente(AlertaAberto alerta, int tentativas, String erro) {
        try {
            pendentes.save(new AvisoPendente(alerta.alertaId(), tentativas, erro));
            log.warn("Aviso do alerta {} ficou pendente depois de {} tentativas ({}).", alerta.alertaId(), tentativas, erro);
        } catch (RuntimeException e) {
            log.error("Aviso do alerta {} não foi enviado nem gravado como pendente: {}.", alerta.alertaId(),
                    e.getClass().getSimpleName());
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
