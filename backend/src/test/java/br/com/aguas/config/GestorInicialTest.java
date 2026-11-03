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

class GestorInicialTest {

    UsuarioRepository usuarios = mock(UsuarioRepository.class);
    PasswordEncoder senhas = mock(PasswordEncoder.class);

    private void rodar(String senha) {
        new GestorInicial(senha, usuarios, senhas).run(null);
    }

    @Test
    void criaAContaDeGestorQuandoNaoExiste() {
        when(senhas.encode("senha-do-gestor")).thenReturn("hash");

        rodar("senha-do-gestor");

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios).save(salvo.capture());
        assertThat(salvo.getValue().getLogin()).isEqualTo("capibaribe.gestor");
        assertThat(salvo.getValue().getPerfil()).isEqualTo(Perfil.gestor);
        assertThat(salvo.getValue().getSenhaHash()).isEqualTo("hash");
    }

    @Test
    void naoMexeNaContaQueJaExiste() {
        when(usuarios.existsByLoginIgnoreCase("capibaribe.gestor")).thenReturn(true);

        rodar("senha-do-gestor");

        verify(usuarios, never()).save(any());
    }

    @Test
    void semSenhaNaoCriaNada() {
        rodar("");

        verify(usuarios, never()).save(any());
    }

    @Test
    void senhaCurtaImpedeASubida() {
        assertThatThrownBy(() -> rodar("curta")).isInstanceOf(IllegalStateException.class);
    }
}
