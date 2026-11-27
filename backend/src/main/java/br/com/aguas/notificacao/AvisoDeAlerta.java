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

import br.com.aguas.config.Urls;
import br.com.aguas.entity.AvisoPendente;
import br.com.aguas.repository.AvisoPendenteRepository;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;

/**
 * Avisa no Telegram quando um alerta é aberto. Roda depois do commit e em outra thread: o lote já está
 * gravado e a resposta ao operador não espera o envio.
 *
 * Se o envio falhar (erro de rede, Telegram fora do ar ou recusando), a API tenta de novo, até 3 vezes
 * no total, com uma pausa entre as tentativas que dobra a cada vez (1 s e depois 2 s, por padrão).
 * Se a falha persistir, o aviso é gravado como pendente em
 * aviso_pendente. Nada disso sobe para quem registrou o lote.
 *
 * Com o Telegram fora do ar, o disjuntor (DisjuntorProperties) abre e as novas tentativas deixam de fazer
 * sentido: a chamada volta na hora com CallNotPermittedException, sem rede e sem tempo limite. Nesse caso o
 * aviso vai direto para a fila de pendentes, sem repetir e sem as pausas.
 */
@Component
public class AvisoDeAlerta {

    /** Total de envios por aviso: o primeiro e mais duas novas tentativas. */
    static final int TENTATIVAS = 3;

    /** Cada pausa é o dobro da anterior (espera exponencial), a partir de app.telegram.espera-entre-tentativas. */
    static final int MULTIPLICADOR = 2;

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
        boolean tentarDeNovo = true;
        while (tentarDeNovo) {
            feitas++;
            try {
                telegram.enviar(texto);
                log.info("Aviso do alerta {} enviado ao Telegram na tentativa {}.", alerta.alertaId(), feitas);
                return;
            } catch (CallNotPermittedException e) {
                // Disjuntor aberto: não houve chamada de rede e o Telegram continua fora do ar. Repetir agora só
                // atrasaria o aviso pelas pausas; a rotina de reenvio tenta de novo quando o disjuntor fechar.
                erro = descrever(e);
                log.warn("Aviso do alerta {}: disjuntor aberto, sem tentar a rede; vai direto para a fila de pendentes.",
                        alerta.alertaId());
                tentarDeNovo = false;
            } catch (RuntimeException e) {
                erro = descrever(e);
                log.warn("Aviso do alerta {}: tentativa {} de {} falhou ({}).", alerta.alertaId(), feitas, TENTATIVAS, erro);
                // Para se acabaram as tentativas ou se a thread foi interrompida durante a pausa.
                tentarDeNovo = feitas < TENTATIVAS && esperar(pausaAntesDaTentativa(feitas + 1));
            }
        }
        guardarPendente(alerta, feitas, erro);
    }

    /** Pausa antes da tentativa n (n >= 2): a inicial antes da 2ª, o dobro antes da 3ª, e assim por diante. */
    Duration pausaAntesDaTentativa(int n) {
        return props.esperaOuPadrao().multipliedBy((long) Math.pow(MULTIPLICADOR, (double) n - 2));
    }

    /** Falso se a thread foi interrompida (a API está parando): não adianta tentar de novo. */
    private boolean esperar(Duration tempo) {
        try {
            pausa.esperar(tempo);
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

    /** Só o status HTTP ou o tipo do erro: a mensagem da exceção pode trazer a URL com o token. */
    static String descrever(RuntimeException e) {
        if (e instanceof CallNotPermittedException) return "DisjuntorAberto";
        return e instanceof RestClientResponseException r ? "HTTP " + r.getStatusCode().value() : e.getClass().getSimpleName();
    }

    String texto(AlertaAberto alerta) {
        String lotes = alerta.loteIds().stream().map(id -> "#" + id).collect(Collectors.joining(", "));
        String texto = "Alerta de consumo de água\n\n"
                + "Processo: " + alerta.processo() + "\n"
                + "3 lotes seguidos acima da meta: " + lotes + "\n"
                + "Alerta #" + alerta.alertaId() + " aberto.";
        String site = props.siteUrl();
        if (site != null && !site.isBlank()) {
            texto += "\n\nVer no sistema: " + Urls.semBarraNoFim(site.trim()) + "/#/alertas/" + alerta.alertaId();
        }
        return texto;
    }
}
