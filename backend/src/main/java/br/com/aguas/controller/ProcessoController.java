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

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.ProcessoDTOs.ProcessoDTO;
import br.com.aguas.dto.ProcessoDTOs.SalvarProcessoDTO;
import br.com.aguas.service.ProcessoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/processos")
@Tag(name = "Processos")
public class ProcessoController {

    private final ProcessoService processos;

    public ProcessoController(ProcessoService processos) {
        this.processos = processos;
    }

    @GetMapping
    @Operation(summary = "Listar processos", description = "Todos os perfis. O sensor usa esta rota para achar o processo pelo nome.")
    public List<ProcessoDTO> listar() {
        return processos.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar processo", description = "Só gestor. Meta em litros por lote ou por peça, maior que zero.")
    @ApiResponse(responseCode = "201", description = "Processo criado.")
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public ProcessoDTO criar(@Valid @RequestBody SalvarProcessoDTO dados) {
        return processos.criar(dados);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Editar processo", description = "Só gestor. A nova meta vale para os próximos lotes; os já registrados não mudam.")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.NaoEncontrado
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public ProcessoDTO atualizar(@PathVariable Integer id, @Valid @RequestBody SalvarProcessoDTO dados) {
        return processos.atualizar(id, dados);
    }
}
