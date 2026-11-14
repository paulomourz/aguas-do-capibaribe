package br.com.aguas.service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.config.AppProperties;
import br.com.aguas.dto.LoteCsvDTO;
import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.LoteRepository;
import br.com.aguas.repository.ProcessoRepository;
import br.com.aguas.repository.UsuarioRepository;

@Service
public class RelatorioService {

    /** Lotes lidos do banco por vez no CSV: a memória usada não cresce com o tamanho do período. */
    static final int LOTES_POR_PAGINA = 1000;

    private final LoteRepository lotes;
    private final ProcessoRepository processos;
    private final UsuarioRepository usuarios;
    private final ZoneId zona;

    public RelatorioService(LoteRepository lotes, ProcessoRepository processos, UsuarioRepository usuarios,
                            AppProperties props) {
        this.lotes = lotes;
        this.processos = processos;
        this.usuarios = usuarios;
        this.zona = props.zonaRelatorios();
    }

    /** Resumo por processo dos lotes registrados no mês, com o mês definido no fuso America/Recife. */
    @Transactional(readOnly = true)
    public List<ResumoProcessoDTO> resumoDoMes(int mes, int ano) {
        LocalDate primeiroDia = LocalDate.of(ano, mes, 1);
        OffsetDateTime inicio = primeiroDia.atStartOfDay(zona).toOffsetDateTime();
        OffsetDateTime fim = primeiroDia.plusMonths(1).atStartOfDay(zona).toOffsetDateTime();
        return lotes.resumir(inicio, fim);
    }

    /** Período do CSV já conferido: do primeiro instante de {@code inicio} até antes do dia seguinte a {@code fim}. */
    public record PeriodoCsv(LocalDate inicio, LocalDate fim, Integer processoId) {

        /** aguas-do-capibaribe-lotes-AAAA-MM-DD-a-AAAA-MM-DD[-processo-N].csv */
        public String nomeArquivo() {
            String sufixo = processoId == null ? "" : "-processo-" + processoId;
            return "aguas-do-capibaribe-lotes-" + inicio + "-a-" + fim + sufixo + ".csv";
        }
    }

    /**
     * Confere os filtros antes de a resposta começar (depois, não dá mais para responder 422).
     * Datas inclusivas, no fuso dos relatórios; no máximo 1 ano por arquivo.
     */
    @Transactional(readOnly = true)
    public PeriodoCsv conferirPeriodoCsv(LocalDate inicio, LocalDate fim, Integer processoId) {
        if (fim.isBefore(inicio)) {
            throw ApiException.validacao("fim", "A data final deve ser igual ou posterior à inicial.");
        }
        if (!fim.isBefore(inicio.plusYears(1))) {
            throw ApiException.validacao("fim", "Escolha um período de até 1 ano.");
        }
        if (processoId != null && !processos.existsById(processoId)) {
            throw ApiException.validacao("processoId", "Selecione um processo válido.");
        }
        return new PeriodoCsv(inicio, fim, processoId);
    }

    /**
     * Escreve o CSV dos lotes do período em {@code saida}, em ordem de registro, sem fechar o fluxo.
     * O cabeçalho sai logo (o download começa antes de ler o primeiro lote) e cada página de
     * {@value #LOTES_POR_PAGINA} lotes é enviada assim que fica pronta.
     */
    public void escreverCsv(PeriodoCsv periodo, OutputStream saida) throws IOException {
        Writer w = new BufferedWriter(new OutputStreamWriter(saida, StandardCharsets.UTF_8), 64 * 1024);
        w.write(CsvDeLotes.BOM);
        w.write(CsvDeLotes.cabecalho());
        w.flush();

        // Processos e usuários são poucos: os nomes ficam em memória; dos lotes, só uma página por vez.
        Map<Integer, String> nomeProcesso = processos.findAll().stream()
                .collect(Collectors.toMap(Processo::getId, Processo::getNome));
        // Só o nome de quem registrou, sem login nem perfil (LGPD, RNF27).
        Map<Integer, String> nomeUsuario = usuarios.findAll().stream()
                .collect(Collectors.toMap(Usuario::getId, Usuario::getNome));

        OffsetDateTime fim = periodo.fim().plusDays(1).atStartOfDay(zona).toOffsetDateTime();
        OffsetDateTime aposData = periodo.inicio().atStartOfDay(zona).toOffsetDateTime();
        int aposId = 0;
        List<LoteCsvDTO> pagina;
        do {
            pagina = lotes.paginaDoCsv(aposData, aposId, fim, periodo.processoId(), Limit.of(LOTES_POR_PAGINA));
            for (LoteCsvDTO l : pagina) {
                w.write(CsvDeLotes.linha(l,
                        nomeProcesso.getOrDefault(l.processoId(), "Processo " + l.processoId()),
                        nomeUsuario.getOrDefault(l.usuarioId(), "Usuário " + l.usuarioId()),
                        zona));
            }
            w.flush();
            if (!pagina.isEmpty()) {
                LoteCsvDTO ultimo = pagina.getLast();
                aposData = ultimo.registradoEm();
                aposId = ultimo.id();
            }
        } while (pagina.size() == LOTES_POR_PAGINA);
    }
}
