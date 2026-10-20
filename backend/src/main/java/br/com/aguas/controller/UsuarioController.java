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

import br.com.aguas.dto.UsuarioDTOs.AtivoDTO;
import br.com.aguas.dto.UsuarioDTOs.AtualizarUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.NovoUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.RedefinirSenhaDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.UsuarioService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioService usuarios;

    public UsuarioController(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    @GetMapping
    public List<UsuarioDTO> listar() {
        return usuarios.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UsuarioDTO criar(@Valid @RequestBody NovoUsuarioDTO dados) {
        return usuarios.criar(dados);
    }

    @PatchMapping("/{id}")
    public UsuarioDTO atualizar(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                @Valid @RequestBody AtualizarUsuarioDTO dados) {
        return usuarios.atualizar(quem, id, dados);
    }

    @PatchMapping("/{id}/senha")
    public UsuarioDTO redefinirSenha(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                     @Valid @RequestBody RedefinirSenhaDTO dados) {
        return usuarios.redefinirSenha(quem, id, dados.senha());
    }

    @PatchMapping("/{id}/ativo")
    public UsuarioDTO definirAtivo(@AuthenticationPrincipal UsuarioAutenticado quem, @PathVariable Integer id,
                                   @Valid @RequestBody AtivoDTO dados) {
        return usuarios.definirAtivo(quem, id, dados.ativo());
    }
}
