package br.com.aguas.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.config.AppProperties;
import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.repository.LoteRepository;

@Service
public class RelatorioService {

    private final LoteRepository lotes;
    private final ZoneId zona;

    public RelatorioService(LoteRepository lotes, AppProperties props) {
        this.lotes = lotes;
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
}
