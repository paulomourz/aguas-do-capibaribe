package br.com.aguas.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.config.RespostasDoc;
import br.com.aguas.dto.UsuarioDTOs.LoginDTO;
import br.com.aguas.dto.UsuarioDTOs.SessaoDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.AuthService;
import br.com.aguas.service.UsuarioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
@Tag(name = "Auth")
public class AuthController {

    private final AuthService auth;
    private final UsuarioService usuarios;

    public AuthController(AuthService auth, UsuarioService usuarios) {
        this.auth = auth;
        this.usuarios = usuarios;
    }

    @PostMapping("/login")
    @SecurityRequirements // rota pública: não pede token
    @Operation(summary = "Entrar",
            description = "Devolve o token JWT (válido por 8 horas) e os dados do usuário. Use o token no botão Authorize.")
    @ApiResponse(responseCode = "200", description = "Login feito.")
    @ApiResponse(responseCode = "401", description = "Usuário ou senha incorretos, ou acesso desativado (mesma mensagem nos três casos).",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = "ErroApi")))
    @RespostasDoc.Validacao
    public SessaoDTO login(@Valid @RequestBody LoginDTO dados) {
        return auth.login(dados);
    }

    /** Recupera a sessão ao recarregar a página (o token fica no sessionStorage do navegador). */
    @GetMapping("/me")
    @Operation(summary = "Usuário do token", description = "Dados de quem está logado. O site usa ao recarregar a página.")
    public UsuarioDTO eu(@AuthenticationPrincipal UsuarioAutenticado quem) {
        return usuarios.buscar(quem.id());
    }
}
