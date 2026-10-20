package br.com.aguas.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.AlertaDTOs.AlertaDTO;
import br.com.aguas.dto.AlertaDTOs.MudarStatusDTO;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.service.AlertaService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/alertas")
public class AlertaController {

    private final AlertaService alertas;

    public AlertaController(AlertaService alertas) {
        this.alertas = alertas;
    }

    @GetMapping
    public List<AlertaDTO> listar(@RequestParam(required = false) StatusAlerta status) {
        return alertas.listar(status);
    }

    @PatchMapping("/{id}/status")
    public AlertaDTO mudarStatus(@PathVariable Integer id, @Valid @RequestBody MudarStatusDTO dados) {
        return alertas.mudarStatus(id, dados.status());
    }
}
