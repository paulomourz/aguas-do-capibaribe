package br.com.aguas.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.service.RelatorioService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/relatorios")
public class RelatorioController {

    private final RelatorioService relatorios;

    public RelatorioController(RelatorioService relatorios) {
        this.relatorios = relatorios;
    }

    @GetMapping("/resumo")
    public List<ResumoProcessoDTO> resumo(
            @RequestParam @Min(value = 1, message = "Mês inválido.") @Max(value = 12, message = "Mês inválido.") int mes,
            @RequestParam @Min(value = 2000, message = "Ano inválido.") @Max(value = 2100, message = "Ano inválido.") int ano) {
        return relatorios.resumoDoMes(mes, ano);
    }
}
