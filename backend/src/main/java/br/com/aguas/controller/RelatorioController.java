package br.com.aguas.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.service.RelatorioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/relatorios")
@Tag(name = "Relatórios")
public class RelatorioController {

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
}
