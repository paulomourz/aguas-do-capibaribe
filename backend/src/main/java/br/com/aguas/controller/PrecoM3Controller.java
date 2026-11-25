package br.com.aguas.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.PrecoM3DTOs.NovoPrecoM3DTO;
import br.com.aguas.dto.PrecoM3DTOs.PrecoM3DTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.PrecoM3Service;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** Sem rota de editar nem de apagar: para corrigir, cadastra-se outro preço com a mesma vigência. */
@RestController
@RequestMapping("/precos-m3")
@Tag(name = "Preço do m³")
public class PrecoM3Controller {

    private final PrecoM3Service precos;

    public PrecoM3Controller(PrecoM3Service precos) {
        this.precos = precos;
    }

    @GetMapping
    @Operation(summary = "Histórico do preço do m³",
            description = "Só gestor. Todos os preços, por vigência e, na mesma vigência, por cadastro, com o nome de quem cadastrou.")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    public List<PrecoM3DTO> listar() {
        return precos.listar();
    }

    /** Quem cadastrou é sempre o do token, nunca um campo do corpo. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastrar preço do m³",
            description = "Só gestor. Valor maior que zero, com até 2 casas, que vale a partir da data informada. "
                    + "Fica no nome de quem está logado e não pode ser alterado nem apagado depois.")
    @ApiResponse(responseCode = "201", description = "Preço cadastrado.")
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    public PrecoM3DTO cadastrar(@AuthenticationPrincipal UsuarioAutenticado quem, @Valid @RequestBody NovoPrecoM3DTO dados) {
        return precos.cadastrar(quem, dados);
    }
}
