package br.com.aguas.notificacao;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.AlertaLote;
import br.com.aguas.entity.AvisoPendente;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.repository.AlertaLoteRepository;
import br.com.aguas.repository.AlertaRepository;
import br.com.aguas.repository.AvisoPendenteRepository;
import br.com.aguas.repository.ProcessoRepository;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;

/**
 * Reenvia os avisos que ficaram pendentes em aviso_pendente (#97). Roda a cada app.telegram.reenvio-a-cada
 * (padrão: 5 minutos), começando um intervalo depois que a API sobe; como os pendentes estão no banco,
 * nada se perde se a API reiniciar.
 *
 * Cada rodada faz uma tentativa por aviso, do mais antigo ao mais novo. Quando um chega, enviado_em recebe
 * a hora e ele não é enviado de novo. Se um falhar, a rodada para ali: o Telegram provavelmente está fora
 * do ar, e a próxima rodada tenta de novo. Depois de app.telegram.reenvio-limite (padrão: 24 horas) desde
 * que ficou pendente, o aviso deixa de ser tentado. Se a última tentativa dele falhar, o log diz que ele não
 * será mais reenviado; se ele vencer sem ter sido tentado (a rodada parou antes nele), fica só na tabela.
 *
 * Só sai aviso de alerta que continua aberto: se alguém já pôs o alerta em análise ou resolveu na tela, o
 * aviso atrasado não ajuda mais e fica pendente até passar do limite.
 *
 * Com o disjuntor aberto a rodada para logo no primeiro aviso, sem contar tentativa: nenhuma chamada chegou a
 * sair. Como o disjuntor fica aberto por 1 minuto e a rodada roda a cada 5, a rodada seguinte sempre encontra
 * o disjuntor pronto para deixar passar uma chamada de teste — é ela que fecha o disjuntor quando o Telegram
 * volta.
 */
@Component
public class ReenvioDeAvisos {

    private static final Logger log = LoggerFactory.getLogger(ReenvioDeAvisos.class);

    private final Telegram telegram;
    private final TelegramProperties props;
    private final AvisoDeAlerta aviso;
    private final AvisoPendenteRepository pendentes;
    private final AlertaRepository alertas;
    private final ProcessoRepository processos;
    private final AlertaLoteRepository vinculos;
    private final Clock relogio;

    @Autowired
    public ReenvioDeAvisos(Telegram telegram, TelegramProperties props, AvisoDeAlerta aviso, AvisoPendenteRepository pendentes,
            AlertaRepository alertas, ProcessoRepository processos, AlertaLoteRepository vinculos) {
        this(telegram, props, aviso, pendentes, alertas, processos, vinculos, Clock.systemUTC());
    }

    ReenvioDeAvisos(Telegram telegram, TelegramProperties props, AvisoDeAlerta aviso, AvisoPendenteRepository pendentes,
            AlertaRepository alertas, ProcessoRepository processos, AlertaLoteRepository vinculos, Clock relogio) {
        this.telegram = telegram;
        this.props = props;
        this.aviso = aviso;
        this.pendentes = pendentes;
        this.alertas = alertas;
        this.processos = processos;
        this.vinculos = vinculos;
        this.relogio = relogio;
    }

    @Scheduled(initialDelayString = "${app.telegram.reenvio-a-cada:5m}", fixedDelayString = "${app.telegram.reenvio-a-cada:5m}")
    public void reenviarPendentes() {
        if (!telegram.configurado()) return;
        OffsetDateTime agora = OffsetDateTime.now(relogio);
        List<AvisoPendente> lista;
        try {
            lista = pendentes.findByEnviadoEmIsNullAndCriadoEmAfterOrderByIdAsc(agora.minus(props.reenvioLimiteOuPadrao()));
        } catch (RuntimeException e) {
            log.warn("Reenvio dos avisos pendentes: não deu para ler a tabela ({}).", e.getClass().getSimpleName());
            return;
        }
        for (AvisoPendente pendente : lista) {
            if (Thread.currentThread().isInterrupted() || !reenviar(pendente, agora)) return;
        }
    }

    /** Falso se algo falhou: a rodada para e a próxima tenta de novo. */
    private boolean reenviar(AvisoPendente pendente, OffsetDateTime agora) {
        Integer alertaId = pendente.getAlertaId();
        String texto;
        try {
            Alerta alerta = alertas.findById(alertaId).orElse(null);
            if (alerta == null || alerta.getStatus() != StatusAlerta.aberto) {
                log.debug("Aviso do alerta {} não reenviado: o alerta não está mais aberto.", alertaId);
                return true;
            }
            texto = texto(alerta);
        } catch (RuntimeException e) {
            // Falha no banco, não no Telegram: não conta como tentativa de envio.
            log.warn("Reenvio do aviso do alerta {}: não deu para montar a mensagem ({}).", alertaId, e.getClass().getSimpleName());
            return false;
        }

        try {
            telegram.enviar(texto);
        } catch (CallNotPermittedException e) {
            // Disjuntor aberto: nenhuma chamada saiu, então não conta como tentativa nem muda o ultimo_erro.
            // A rodada para aqui; na próxima o disjuntor já deixa passar uma chamada de teste.
            log.debug("Reenvio do aviso do alerta {} adiado: disjuntor aberto.", alertaId);
            return false;
        } catch (RuntimeException e) {
            String erro = AvisoDeAlerta.descrever(e);
            pendente.registrarFalha(erro);
            salvar(pendente);
            if (ultimaTentativa(pendente, agora)) {
                log.error("Aviso do alerta {} não chegou ao Telegram em {} tentativas ({}) e não será mais reenviado.",
                        alertaId, pendente.getTentativas(), erro);
            } else {
                log.warn("Reenvio do aviso do alerta {} falhou na tentativa {} ({}).", alertaId, pendente.getTentativas(), erro);
            }
            return false;
        }

        pendente.marcarEnviado(OffsetDateTime.now(relogio));
        salvar(pendente);
        log.info("Aviso pendente do alerta {} enviado ao Telegram na tentativa {}.", alertaId, pendente.getTentativas());
        return true;
    }

    /** A próxima rodada já passaria do limite: esta foi a última tentativa desse aviso. */
    boolean ultimaTentativa(AvisoPendente pendente, OffsetDateTime agora) {
        OffsetDateTime proxima = agora.plus(props.reenvioACadaOuPadrao());
        return !pendente.getCriadoEm().plus(props.reenvioLimiteOuPadrao()).isAfter(proxima);
    }

    private void salvar(AvisoPendente pendente) {
        try {
            pendentes.save(pendente);
        } catch (RuntimeException e) {
            // Se o envio deu certo e a gravação não, a próxima rodada pode mandar o aviso de novo (repetido, não perdido).
            log.error("Aviso do alerta {}: não deu para gravar a tentativa ({}).", pendente.getAlertaId(),
                    e.getClass().getSimpleName());
        }
    }

    /** Mesma mensagem do aviso original, com uma linha dizendo que ela está atrasada. */
    String texto(Alerta alerta) {
        String processo = processos.findById(alerta.getProcessoId()).map(Processo::getNome)
                .orElse("#" + alerta.getProcessoId());
        List<Integer> lotes = vinculos.findByAlertaIdIn(List.of(alerta.getId())).stream()
                .map(AlertaLote::getLoteId).sorted().toList();
        return "Aviso atrasado: o Telegram não respondeu quando o alerta abriu.\n\n"
                + aviso.texto(new AlertaAberto(alerta.getId(), processo, lotes));
    }
}
