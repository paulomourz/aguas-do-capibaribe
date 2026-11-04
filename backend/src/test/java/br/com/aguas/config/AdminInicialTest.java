package br.com.aguas.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;

class AdminInicialTest {

    UsuarioRepository usuarios = mock(UsuarioRepository.class);
    PasswordEncoder senhas = mock(PasswordEncoder.class);
    AdminInicial inicial = new AdminInicial(new AdminProperties("capibaribe.admin", "Admin", "senha-do-admin"), usuarios, senhas);

    @Test
    void criaComoAdministradorQuandoNaoExiste() {
        when(usuarios.findByLoginIgnoreCase("capibaribe.admin")).thenReturn(Optional.empty());

        inicial.run(null);

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios).save(salvo.capture());
        assertThat(salvo.getValue().getPerfil()).isEqualTo(Perfil.admin);
    }

    @Test
    void promoveAContaAntigaSemTrocarASenha() {
        Usuario antigo = new Usuario("Admin", "capibaribe.admin", "hash-antigo", Perfil.gestor);
        when(usuarios.findByLoginIgnoreCase("capibaribe.admin")).thenReturn(Optional.of(antigo));

        inicial.run(null);

        assertThat(antigo.getPerfil()).isEqualTo(Perfil.admin);
        assertThat(antigo.getSenhaHash()).isEqualTo("hash-antigo");
        verify(senhas, never()).encode(any());
    }
}
