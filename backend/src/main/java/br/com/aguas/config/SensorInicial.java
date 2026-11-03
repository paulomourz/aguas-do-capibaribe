package br.com.aguas.config;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;

/**
 * Garante a conta do sensor: se ela não existe no banco e SENSOR_SENHA foi definida, é criada na
 * inicialização. Se já existe, nada é alterado (a senha trocada pelo site é preservada).
 * Sem SENSOR_SENHA, a API sobe normalmente e a conta não é criada.
 */
@Component
public class SensorInicial implements ApplicationRunner {

    static final String LOGIN = "sensor.wokwi";
    static final String NOME = "Sensor de vazão (Wokwi)";

    private static final Logger log = LoggerFactory.getLogger(SensorInicial.class);

    private final String senha;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;

    public SensorInicial(@Value("${app.sensor.senha:}") String senha, UsuarioRepository usuarios,
            PasswordEncoder senhas) {
        this.senha = senha;
        this.usuarios = usuarios;
        this.senhas = senhas;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (senha == null || senha.isBlank() || usuarios.existsByLoginIgnoreCase(LOGIN)) return;

        if (senha.length() < 8 || senha.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("SENSOR_SENHA precisa ter de 8 a 72 bytes.");
        }
        usuarios.save(new Usuario(NOME, LOGIN, senhas.encode(senha), Perfil.operador));
        log.info("Conta do sensor '{}' criada.", LOGIN);
    }
}
