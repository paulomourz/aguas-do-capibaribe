package br.com.aguas.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.AlertaDTOs.AlertaDTO;
import br.com.aguas.dto.AlertaDTOs.MudarStatusDTO;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.service.AlertaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/alertas")
@Tag(name = "Alertas")
public class AlertaController {

    private final AlertaService alertas;

    public AlertaController(AlertaService alertas) {
        this.alertas = alertas;
    }

    @GetMapping
    @Operation(summary = "Listar alertas",
            description = "Só gestor. Cada alerta traz os lotes que o geraram (3 ou mais lotes seguidos acima da meta).")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    public List<AlertaDTO> listar(@Parameter(description = "Filtra pelo status") @RequestParam(required = false) StatusAlerta status) {
        return alertas.listar(status);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Mudar status do alerta",
            description = "Só gestor. Caminho permitido: aberto → em análise → resolvido (ou aberto → resolvido).")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.NaoEncontrado
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public AlertaDTO mudarStatus(@PathVariable Integer id, @Valid @RequestBody MudarStatusDTO dados) {
        return alertas.mudarStatus(id, dados.status());
    }
}
