package br.com.aguas.controller;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.LoteDTOs.LoteDTO;
import br.com.aguas.dto.LoteDTOs.NovoLoteDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.LoteService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/lotes")
public class LoteController {

    private final LoteService lotes;

    public LoteController(LoteService lotes) {
        this.lotes = lotes;
    }

    /** inicio/fim em ISO 8601 com fuso (ex.: 2026-09-01T00:00:00-03:00). */
    @GetMapping
    public List<LoteDTO> listar(@AuthenticationPrincipal UsuarioAutenticado quem,
                                @RequestParam(required = false) Integer processoId,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime inicio,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fim) {
        return lotes.listar(quem, processoId, inicio, fim);
    }

    @GetMapping("/{id}")
    public LoteDTO buscar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id) {
        return lotes.buscar(quem, id);
    }

    /** O usuário do lote é sempre o do token, nunca um campo do corpo. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoteDTO registrar(@AuthenticationPrincipal UsuarioAutenticado quem, @Valid @RequestBody NovoLoteDTO dados) {
        return lotes.registrar(quem, dados);
    }
}
