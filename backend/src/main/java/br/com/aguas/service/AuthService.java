package br.com.aguas.service;

import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.UsuarioDTOs.LoginDTO;
import br.com.aguas.dto.UsuarioDTOs.SessaoDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.JwtService;

@Service
public class AuthService {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final JwtService jwt;
    private final EventosDeSeguranca eventos;
    /** Hash descartável: compara senha mesmo quando o usuário não existe, para não revelar isso pelo tempo de resposta. */
    private final String hashFicticio;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder senhas, JwtService jwt, EventosDeSeguranca eventos) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.jwt = jwt;
        this.eventos = eventos;
        this.hashFicticio = senhas.encode("senha-ficticia-para-tempo-constante");
    }

    @Transactional(readOnly = true)
    public SessaoDTO login(LoginDTO dados) {
        Optional<Usuario> u = usuarios.findByLoginIgnoreCase(dados.usuario().trim());
        boolean senhaOk = senhas.matches(dados.senha(), u.map(Usuario::getSenhaHash).orElse(hashFicticio));
        if (u.isEmpty() || !senhaOk || !u.get().isAtivo()) {
            // Mesma mensagem para usuário inexistente, senha errada ou acesso desativado.
            eventos.loginRecusado();
            throw new ApiException(HttpStatus.UNAUTHORIZED, "CREDENCIAIS_INVALIDAS", "Usuário ou senha incorretos.", null);
        }
        eventos.loginAceito();
        return new SessaoDTO(jwt.gerar(u.get().getId()), UsuarioDTO.de(u.get()));
    }
}
