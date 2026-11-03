package br.com.aguas.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;

class SensorInicialTest {

    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final PasswordEncoder senhas = mock(PasswordEncoder.class);

    private void rodar(String senha) {
        new SensorInicial(senha, usuarios, senhas).run(null);
    }

    @Test
    void criaAContaDeSensorQuandoNaoExiste() {
        when(senhas.encode("senha-do-sensor")).thenReturn("hash");

        rodar("senha-do-sensor");

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios).save(salvo.capture());
        assertThat(salvo.getValue().getLogin()).isEqualTo("sensor.wokwi");
        assertThat(salvo.getValue().getPerfil()).isEqualTo(Perfil.sensor);
        assertThat(salvo.getValue().getSenhaHash()).isEqualTo("hash");
    }

    @Test
    void naoAlteraContaQueJaExiste() {
        when(usuarios.existsByLoginIgnoreCase("sensor.wokwi")).thenReturn(true);

        rodar("senha-do-sensor");

        verify(usuarios, never()).save(any());
    }

    @Test
    void semSenhaNaoCriaEASubidaContinua() {
        rodar("");

        verify(usuarios, never()).save(any());
    }

    @Test
    void recusaSenhaCurta() {
        assertThatThrownBy(() -> rodar("curta")).isInstanceOf(IllegalStateException.class);
        verify(usuarios, never()).save(any());
    }
}
