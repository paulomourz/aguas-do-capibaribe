package br.com.aguas.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.ProcessoDTOs.ProcessoDTO;
import br.com.aguas.dto.ProcessoDTOs.SalvarProcessoDTO;
import br.com.aguas.service.ProcessoService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/processos")
public class ProcessoController {

    private final ProcessoService processos;

    public ProcessoController(ProcessoService processos) {
        this.processos = processos;
    }

    @GetMapping
    public List<ProcessoDTO> listar() {
        return processos.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProcessoDTO criar(@Valid @RequestBody SalvarProcessoDTO dados) {
        return processos.criar(dados);
    }

    @PutMapping("/{id}")
    public ProcessoDTO atualizar(@PathVariable Integer id, @Valid @RequestBody SalvarProcessoDTO dados) {
        return processos.atualizar(id, dados);
    }
}
