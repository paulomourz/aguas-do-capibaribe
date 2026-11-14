package br.com.aguas.controller;

import java.time.OffsetDateTime;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.AuditoriaDTOs.PaginaAuditoriaDTO;
import br.com.aguas.dto.AuditoriaDTOs.SegurancaDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.service.AuditoriaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/auditoria")
@Tag(name = "Auditoria")
public class AuditoriaController {

    private final AuditoriaService auditoria;
    private final EventosDeSeguranca eventos;

    public AuditoriaController(AuditoriaService auditoria, EventosDeSeguranca eventos) {
        this.auditoria = auditoria;
        this.eventos = eventos;
    }

    /** inicio/fim em ISO 8601 com fuso (ex.: 2026-09-01T00:00:00-03:00). */
    @GetMapping
    @Operation(summary = "Registros de auditoria",
            description = "Só administrador. Ações de um administrador ou gestor sobre a conta de outra pessoa, do mais recente ao mais antigo. "
                    + "Os registros não podem ser alterados nem apagados, e não guardam senha.")
    @RespostasDoc.Ok
    @RespostasDoc.SoAdmin
    @RespostasDoc.Validacao
    public PaginaAuditoriaDTO listar(
            @Parameter(description = "Data e hora inicial, ISO 8601 com fuso", example = "2026-09-01T00:00:00-03:00")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime inicio,
            @Parameter(description = "Data e hora final, ISO 8601 com fuso", example = "2026-09-30T23:59:59-03:00")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fim,
            @Parameter(description = "Filtra pelo tipo de ação") @RequestParam(required = false) AcaoAuditoria acao,
            @Parameter(description = "Página, a partir de 0") @RequestParam(defaultValue = "0")
            @Min(value = 0, message = "Página inválida.") int pagina,
            @Parameter(description = "Registros por página, de 1 a 100") @RequestParam(defaultValue = "20")
            @Min(value = 1, message = "Tamanho inválido.") @Max(value = 100, message = "Tamanho inválido.") int tamanho) {
        return auditoria.listar(inicio, fim, acao, pagina, tamanho);
    }

    @GetMapping("/seguranca")
    @Operation(summary = "Eventos de segurança",
            description = "Só administrador. Logins aceitos e recusados, requisições bloqueadas pelo limite (429) e trocas de senha, "
                    + "contados desde o último início da API (campo desde), mais os bloqueios recentes por IP, com o IP mascarado. "
                    + "Fica em memória, sem tabela: os números zeram quando a API reinicia. Nenhuma senha é guardada.")
    @RespostasDoc.Ok
    @RespostasDoc.SoAdmin
    public SegurancaDTO seguranca() {
        return eventos.resumo();
    }
}
