package br.com.aguas.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.UsuarioDTOs.AtivoDTO;
import br.com.aguas.dto.UsuarioDTOs.AtualizarUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.NovoUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.RedefinirSenhaDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.UsuarioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/usuarios")
@Tag(name = "Usuários")
public class UsuarioController {

    private final UsuarioService usuarios;

    public UsuarioController(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    @GetMapping
    @Operation(summary = "Listar usuários", description = "Só gestor.")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    public List<UsuarioDTO> listar() {
        return usuarios.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Criar usuário", description = "Só gestor. Não existe autocadastro.")
    @ApiResponse(responseCode = "201", description = "Usuário criado.")
    @RespostasDoc.SoGestor
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public UsuarioDTO criar(@AuthenticationPrincipal UsuarioAutenticado quem, @Valid @RequestBody NovoUsuarioDTO dados) {
        return usuarios.criar(quem, dados);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Alterar a própria conta",
            description = "Nome e/ou senha (a troca de senha pede a senha atual). Cada pessoa só altera a própria conta.")
    @ApiResponse(responseCode = "403", description = "O id não é o de quem está logado.",
            content = @io.swagger.v3.oas.annotations.media.Content(mediaType = "application/json",
                    schema = @io.swagger.v3.oas.annotations.media.Schema(ref = "ErroApi")))
    @RespostasDoc.Ok
    @RespostasDoc.NaoEncontrado
    @RespostasDoc.Validacao
    public UsuarioDTO atualizar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                @Valid @RequestBody AtualizarUsuarioDTO dados) {
        return usuarios.atualizar(quem, id, dados);
    }

    @PatchMapping("/{id}/senha")
    @Operation(summary = "Redefinir a senha de outra pessoa",
            description = "Só gestor, para quem esqueceu a senha. A senha antiga deixa de valer na hora. "
                    + "Não vale para a própria senha nem para a do administrador principal.")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.NaoEncontrado
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public UsuarioDTO redefinirSenha(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                     @Valid @RequestBody RedefinirSenhaDTO dados) {
        return usuarios.redefinirSenha(quem, id, dados.senha());
    }

    @PatchMapping("/{id}/ativo")
    @Operation(summary = "Desativar ou reativar acesso",
            description = "Só gestor. Quem é desativado perde o acesso na hora; os lotes dele continuam no histórico. "
                    + "Não vale para a própria conta nem para o administrador principal.")
    @RespostasDoc.Ok
    @RespostasDoc.SoGestor
    @RespostasDoc.NaoEncontrado
    @RespostasDoc.Validacao
    @RespostasDoc.Conflito
    public UsuarioDTO definirAtivo(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                   @Valid @RequestBody AtivoDTO dados) {
        return usuarios.definirAtivo(quem, id, dados.ativo());
    }
}
