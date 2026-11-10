package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.UsuarioAutenticado;

/** LGPD (RNF27): login de outras pessoas mascarado onde não é necessário. */
class PrivacidadeTest {

    @ParameterizedTest
    @CsvSource({
        "carlos.martin, ca****in",
        "operador02, op****02",
        "sensor.wokwi, se****wi",
        "maria, m****a",
        "joao.s, j****s",
        "ana, a****",
        "joao, j****",
    })
    void mascaraOLoginSemRevelarMaisDaMetadeNemOTamanho(String login, String esperado) {
        assertThat(Privacidade.mascararLogin(login)).isEqualTo(esperado);
    }

    @Test
    void loginAusenteContinuaAusente() {
        assertThat(Privacidade.mascararLogin(null)).isNull();
        assertThat(Privacidade.mascararLogin("")).isEqualTo("****");
    }

    // ---------- lista de usuários ----------

    UsuarioRepository repo = mock(UsuarioRepository.class);
    UsuarioService servico = new UsuarioService(repo, null, null, null);

    private static Usuario usuario(int id, String nome, String login, Perfil perfil) {
        Usuario u = new Usuario(nome, login, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private List<UsuarioDTO> listarComo(int id, Perfil perfil) {
        when(repo.findAll(Sort.by("id"))).thenReturn(List.of(
                usuario(1, "Administradora", "admin.lavanderia", Perfil.admin),
                usuario(2, "Gestora", "gestora.silva", Perfil.gestor),
                usuario(3, "Carlos Martin", "carlos.martin", Perfil.operador)));
        return servico.listar(new UsuarioAutenticado(id, perfil));
    }

    @Test
    void administradorRecebeOsLoginsInteiros() {
        assertThat(listarComo(1, Perfil.admin)).extracting(UsuarioDTO::usuario)
                .containsExactly("admin.lavanderia", "gestora.silva", "carlos.martin");
    }

    @Test
    void gestorRecebeOsNomesInteirosEOsLoginsDosOutrosMascarados() {
        List<UsuarioDTO> lista = listarComo(2, Perfil.gestor);
        assertThat(lista).extracting(UsuarioDTO::nome).containsExactly("Administradora", "Gestora", "Carlos Martin");
        assertThat(lista).extracting(UsuarioDTO::usuario).containsExactly("ad****ia", "gestora.silva", "ca****in");
    }
}
