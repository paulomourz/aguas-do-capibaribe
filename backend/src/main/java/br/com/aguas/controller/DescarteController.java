package br.com.aguas.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.DescarteDTOs.DescarteDTO;
import br.com.aguas.dto.DescarteDTOs.NovoDescarteDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.DescarteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Descarte de efluentes de cada lote (issue #201). Sem PUT nem DELETE: é registro de auditoria ambiental. */
@RestController
@RequestMapping("/lotes/{loteId}/descartes")
@Tag(name = "Lotes")
public class DescarteController {

    private final DescarteService descartes;

    public DescarteController(DescarteService descartes) {
        this.descartes = descartes;
    }

    @GetMapping
    @Operation(summary = "Descartes de efluentes do lote",
            description = "Do mais recente ao mais antigo. O operador só alcança os lotes que registrou.")
    @RespostasDoc.Ok
    @RespostasDoc.NaoEncontrado
    public List<DescarteDTO> listar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer loteId) {
        return descartes.listar(quem, loteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Registrar descarte de efluentes",
            description = "Volume, pH (0 a 14), turbidez em NTU e o percentual reaproveitado (0 a 100, opcional). "
                    + "A data é a do servidor. O descarte não pode ser alterado nem excluído depois.")
    @ApiResponse(responseCode = "201", description = "Descarte registrado.")
    @RespostasDoc.Validacao
    @RespostasDoc.NaoEncontrado
    public DescarteDTO registrar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer loteId,
                                 @Valid @RequestBody NovoDescarteDTO dados) {
        return descartes.registrar(quem, loteId, dados);
    }
}
