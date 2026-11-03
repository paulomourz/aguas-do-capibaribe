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

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.LoteDTOs.LoteDTO;
import br.com.aguas.dto.LoteDTOs.NovoLoteDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.LoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/lotes")
@Tag(name = "Lotes")
public class LoteController {

    private final LoteService lotes;

    public LoteController(LoteService lotes) {
        this.lotes = lotes;
    }

    /** inicio/fim em ISO 8601 com fuso (ex.: 2026-09-01T00:00:00-03:00). */
    @GetMapping
    @Operation(summary = "Histórico de lotes",
            description = "Do mais recente ao mais antigo. O operador vê só os lotes que registrou; o gestor vê todos.")
    @RespostasDoc.Ok
    @RespostasDoc.Validacao
    public List<LoteDTO> listar(@AuthenticationPrincipal UsuarioAutenticado quem,
                                @Parameter(description = "Filtra por processo") @RequestParam(required = false) Integer processoId,
                                @Parameter(description = "Data e hora inicial, ISO 8601 com fuso", example = "2026-09-01T00:00:00-03:00")
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime inicio,
                                @Parameter(description = "Data e hora final, ISO 8601 com fuso", example = "2026-09-30T23:59:59-03:00")
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime fim) {
        return lotes.listar(quem, processoId, inicio, fim);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Um lote", description = "O operador só encontra os lotes que ele registrou.")
    @RespostasDoc.Ok
    @RespostasDoc.NaoEncontrado
    public LoteDTO buscar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id) {
        return lotes.buscar(quem, id);
    }

    /** O usuário do lote é sempre o do token, nunca um campo do corpo. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Registrar lote",
            description = "O banco calcula o esperado pela meta do processo e a API calcula o desvio. "
                    + "O lote fica no nome de quem está logado e não pode ser alterado depois. "
                    + "Se for o 3º lote seguido acima da meta, abre um alerta.")
    @ApiResponse(responseCode = "201", description = "Lote registrado.")
    @RespostasDoc.Validacao
    public LoteDTO registrar(@AuthenticationPrincipal UsuarioAutenticado quem, @Valid @RequestBody NovoLoteDTO dados) {
        return lotes.registrar(quem, dados);
    }
}
