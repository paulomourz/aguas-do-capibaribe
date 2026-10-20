package br.com.aguas.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.UsuarioDTOs.LoginDTO;
import br.com.aguas.dto.UsuarioDTOs.SessaoDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.AuthService;
import br.com.aguas.service.UsuarioService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;
    private final UsuarioService usuarios;

    public AuthController(AuthService auth, UsuarioService usuarios) {
        this.auth = auth;
        this.usuarios = usuarios;
    }

    @PostMapping("/login")
    public SessaoDTO login(@Valid @RequestBody LoginDTO dados) {
        return auth.login(dados);
    }

    /** Recupera a sessão ao recarregar a página (o token fica no sessionStorage do navegador). */
    @GetMapping("/me")
    public UsuarioDTO eu(@AuthenticationPrincipal UsuarioAutenticado quem) {
        return usuarios.buscar(quem.id());
    }
}
