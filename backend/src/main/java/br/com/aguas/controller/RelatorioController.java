package br.com.aguas.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.service.RelatorioService;
import br.com.aguas.service.RelatorioService.PeriodoCsv;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/relatorios")
@Tag(name = "Relatórios")
public class RelatorioController {

    static final MediaType CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);

    private final RelatorioService relatorios;

    public RelatorioController(RelatorioService relatorios) {
        this.relatorios = relatorios;
    }

    @GetMapping("/resumo")
    @Operation(summary = "Resumo do mês por processo",
            description = "Só gestor. Litros consumidos, esperados e quantidade de lotes de cada processo no mês "
                    + "(o mês é contado no fuso America/Recife).")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    public List<ResumoProcessoDTO> resumo(
            @Parameter(description = "Mês de 1 a 12", example = "9")
            @RequestParam @Min(value = 1, message = "Mês inválido.") @Max(value = 12, message = "Mês inválido.") int mes,
            @Parameter(description = "Ano com 4 dígitos", example = "2026")
            @RequestParam @Min(value = 2000, message = "Ano inválido.") @Max(value = 2100, message = "Ano inválido.") int ano) {
        return relatorios.resumoDoMes(mes, ano);
    }

    /** O arquivo é escrito enquanto é lido do banco, uma página de lotes por vez (issue #99). */
    @GetMapping("/csv")
    @Operation(summary = "Lotes do período em CSV",
            description = "Só gestor. Todos os lotes do período, em ordem de registro, no mesmo formato do CSV do "
                    + "Histórico: UTF-8 com BOM, separador `;`, vírgula decimal, data e hora de Recife e em UTC. "
                    + "As datas são inclusivas, no fuso America/Recife, e o período vai até 1 ano. O download começa "
                    + "antes de o arquivo ficar pronto: os lotes são lidos e enviados de 1.000 em 1.000.")
    @ApiResponse(responseCode = "200", description = "Arquivo CSV.",
            content = @Content(mediaType = "text/csv"))
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    public ResponseEntity<StreamingResponseBody> csv(
            @Parameter(description = "Primeiro dia, AAAA-MM-DD", example = "2026-01-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @Parameter(description = "Último dia (inclusive), AAAA-MM-DD", example = "2026-12-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @Parameter(description = "Só os lotes deste processo (opcional)")
            @RequestParam(required = false) Integer processoId) {
        PeriodoCsv periodo = relatorios.conferirPeriodoCsv(inicio, fim, processoId);
        StreamingResponseBody corpo = saida -> relatorios.escreverCsv(periodo, saida);
        return ResponseEntity.ok()
                .contentType(CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(periodo.nomeArquivo()).build().toString())
                .body(corpo);
    }
}
