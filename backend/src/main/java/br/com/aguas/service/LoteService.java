package br.com.aguas.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.LoteDTOs.LoteDTO;
import br.com.aguas.dto.LoteDTOs.NovoLoteDTO;
import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.AlertaLote;
import br.com.aguas.entity.Lote;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.Unidade;
import br.com.aguas.exception.ApiException;
import br.com.aguas.notificacao.AlertaAberto;
import br.com.aguas.repository.AlertaLoteRepository;
import br.com.aguas.repository.AlertaRepository;
import br.com.aguas.repository.LoteRepository;
import br.com.aguas.repository.ProcessoRepository;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.RegraDeAlerta.Anexar;
import br.com.aguas.service.RegraDeAlerta.Criar;
import br.com.aguas.service.RegraDeAlerta.LoteAvaliado;

@Service
public class LoteService {

    /** Maior valor que cabe em lote.esperado numeric(14,2). */
    private static final BigDecimal LIMITE_ESPERADO = new BigDecimal("999999999999.99");
    private static final Sort MAIS_RECENTES = Sort.by(Sort.Order.desc("registradoEm"), Sort.Order.desc("id"));

    private final LoteRepository lotes;
    private final ProcessoRepository processos;
    private final AlertaRepository alertas;
    private final AlertaLoteRepository vinculos;
    private final ApplicationEventPublisher eventos;

    public LoteService(LoteRepository lotes, ProcessoRepository processos, AlertaRepository alertas,
                       AlertaLoteRepository vinculos, ApplicationEventPublisher eventos) {
        this.lotes = lotes;
        this.processos = processos;
        this.alertas = alertas;
        this.vinculos = vinculos;
        this.eventos = eventos;
    }

    /**
     * Gestor e administrador veem todos os lotes e podem filtrar por quem registrou (issue #107);
     * o operador vê apenas os próprios, e o filtro de usuário é ignorado para ele.
     */
    @Transactional(readOnly = true)
    public List<LoteDTO> listar(UsuarioAutenticado quem, Integer processoId, Integer usuarioId,
                                OffsetDateTime inicio, OffsetDateTime fim) {
        Integer deQuem = quem.gestor() ? usuarioId : quem.id();
        return lotes.findAll(LoteRepository.filtro(processoId, deQuem, inicio, fim), MAIS_RECENTES)
                .stream().map(LoteDTO::de).toList();
    }

    @Transactional(readOnly = true)
    public LoteDTO buscar(UsuarioAutenticado quem, Integer id) {
        return lotes.findById(id)
                .filter(l -> quem.gestor() || l.getUsuarioId().equals(quem.id()))
                .map(LoteDTO::de)
                .orElseThrow(() -> ApiException.naoEncontrado("Lote não encontrado."));
    }

    /** Resultado do registro: {@code repetido} = a chave de envio já existia e nada novo foi gravado. */
    public record Registro(LoteDTO lote, boolean repetido) {}

    /**
     * Registra o lote (esperado é calculado pelo trigger do banco) e aplica a regra de alerta na mesma transação.
     *
     * <p>Com {@code chaveEnvio} (cabeçalho Idempotency-Key do site), um reenvio da mesma chave devolve o lote já
     * gravado, sem criar outro nem reaplicar a regra de alerta. A busca pela chave acontece depois do bloqueio do
     * processo: dois envios simultâneos da mesma chave (mesmo processo) passam um de cada vez, e o segundo já
     * encontra o primeiro. O índice único ux_lote_chave_envio é a última garantia.
     */
    @Transactional
    public Registro registrar(UsuarioAutenticado quem, NovoLoteDTO dados, UUID chaveEnvio) {
        Processo p = processos.buscarComBloqueio(dados.processoId())
                .orElseThrow(() -> ApiException.validacao("processoId", "Selecione um processo válido."));

        if (chaveEnvio != null) {
            Optional<Lote> existente = lotes.findByChaveEnvio(chaveEnvio);
            if (existente.isPresent()) return new Registro(LoteDTO.de(conferirReenvio(existente.get(), quem, dados)), true);
        }

        BigDecimal esperadoPrevisto = p.getUnidade() == Unidade.peca
                ? p.getMeta().multiply(BigDecimal.valueOf(dados.pecas()))
                : p.getMeta();
        if (esperadoPrevisto.compareTo(LIMITE_ESPERADO) > 0) {
            throw ApiException.validacao("pecas", "Quantidade de peças grande demais para a meta deste processo.");
        }

        Lote novo = lotes.saveAndFlush(new Lote(p.getId(), quem.id(), dados.pecas(), dados.litros(), chaveEnvio));
        aplicarRegraDeAlerta(novo, p);
        return new Registro(LoteDTO.de(novo), false);
    }

    /** A chave só vale para o mesmo usuário e os mesmos dados; outra coisa é erro do cliente, não reenvio. */
    private static Lote conferirReenvio(Lote l, UsuarioAutenticado quem, NovoLoteDTO dados) {
        boolean mesmoUsuario = l.getUsuarioId().equals(quem.id());
        boolean mesmosDados = l.getProcessoId().equals(dados.processoId()) && l.getPecas().equals(dados.pecas())
                && l.getLitros().compareTo(dados.litros()) == 0;
        if (!mesmoUsuario || !mesmosDados) {
            throw ApiException.conflito("CHAVE_DE_ENVIO_REPETIDA",
                    "Esta chave de envio já foi usada em outro lote. Gere uma nova chave para registrar um lote diferente.", null);
        }
        return l;
    }

    private void aplicarRegraDeAlerta(Lote novo, Processo p) {
        if (!novo.acimaDoEsperado()) return;

        List<Lote> recentes = new ArrayList<>();
        recentes.add(novo);
        recentes.addAll(lotes.findTop2ByProcessoIdAndIdNotOrderByRegistradoEmDescIdDesc(novo.getProcessoId(), novo.getId()));

        Map<Integer, Integer> alertaDoLote = vinculos.findByLoteIdIn(recentes.stream().map(Lote::getId).toList())
                .stream().collect(Collectors.toMap(AlertaLote::getLoteId, AlertaLote::getAlertaId));
        Map<Integer, Alerta> alertasPorId = alertas.findAllById(alertaDoLote.values())
                .stream().collect(Collectors.toMap(Alerta::getId, Function.identity()));

        List<LoteAvaliado> avaliados = recentes.stream().map(l -> {
            Integer alertaId = alertaDoLote.get(l.getId());
            Alerta a = alertaId == null ? null : alertasPorId.get(alertaId);
            return new LoteAvaliado(l.getId(), l.acimaDoEsperado(), alertaId, a == null ? null : a.getStatus());
        }).toList();

        switch (RegraDeAlerta.decidir(avaliados)) {
            case Anexar a -> vinculos.save(new AlertaLote(novo.getId(), a.alertaId()));
            case Criar c -> {
                Alerta alerta = alertas.saveAndFlush(new Alerta(novo.getProcessoId()));
                c.loteIds().forEach(id -> vinculos.save(new AlertaLote(id, alerta.getId())));
                // O aviso no Telegram só sai depois do commit (AvisoDeAlerta).
                eventos.publishEvent(new AlertaAberto(alerta.getId(), p.getNome(), c.loteIds()));
            }
            case RegraDeAlerta.Nenhuma n -> { }
        }
    }
}
