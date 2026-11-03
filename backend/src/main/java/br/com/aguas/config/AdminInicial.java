package br.com.aguas.config;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;

/**
 * Garante o administrador principal: se ele não existe no banco, é criado na inicialização com a
 * senha de ADMIN_SENHA. Se já existe, nada é alterado (a senha trocada pelo site é preservada).
 * Sem o administrador e sem ADMIN_SENHA, a API não sobe.
 */
@Component
public class AdminInicial implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInicial.class);

    private final AdminProperties props;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;

    public AdminInicial(AdminProperties props, UsuarioRepository usuarios, PasswordEncoder senhas) {
        this.props = props;
        this.usuarios = usuarios;
        this.senhas = senhas;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String login = props.loginOuPadrao();
        var existente = usuarios.findByLoginIgnoreCase(login);
        if (existente.isPresent()) {
            // Em bancos anteriores à V6, o administrador principal tinha o perfil de gestor.
            if (existente.get().getPerfil() != Perfil.admin) {
                existente.get().setPerfil(Perfil.admin);
                log.info("Administrador principal '{}' passou para o perfil de administrador.", login);
            }
            return;
        }

        String senha = props.senha();
        if (senha == null || senha.isBlank()) {
            throw new IllegalStateException("O administrador principal '" + login + "' não existe no banco. "
                    + "Defina ADMIN_SENHA para criá-lo nesta inicialização.");
        }
        if (senha.length() < 8 || senha.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("ADMIN_SENHA precisa ter de 8 a 72 bytes.");
        }
        usuarios.save(new Usuario(props.nomeOuPadrao(), login, senhas.encode(senha), Perfil.admin));
        log.info("Administrador principal '{}' criado. Troque a senha pelo site no primeiro acesso.", login);
    }
}
