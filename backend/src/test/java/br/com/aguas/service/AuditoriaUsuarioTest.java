package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.config.AdminProperties;
import br.com.aguas.dto.UsuarioDTOs.NovoUsuarioDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.AuditoriaUsuarioRepository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.UsuarioAutenticado;

/** Auditoria das ações do gestor sobre outros usuários (issue #16), sem banco. */
class AuditoriaUsuarioTest {

    static final int GESTOR = 1;
    static final int OPERADOR = 2;
    static final int ADMIN = 3;

    UsuarioRepository usuarios = mock(UsuarioRepository.class);
    AuditoriaUsuarioRepository auditoria = mock(AuditoriaUsuarioRepository.class);
    UsuarioService servico = new UsuarioService(usuarios, new BCryptPasswordEncoder(4),
            new AdminProperties("capibaribe.admin", null, null), auditoria, EventosDeSeguranca.paraTeste());
    UsuarioAutenticado gestor = new UsuarioAutenticado(GESTOR, Perfil.gestor);

    @BeforeEach
    void contas() {
        when(usuarios.findById(OPERADOR)).thenReturn(Optional.of(usuario(OPERADOR, "joao", Perfil.operador)));
        when(usuarios.findById(ADMIN)).thenReturn(Optional.of(usuario(ADMIN, "capibaribe.admin", Perfil.gestor)));
    }

    @Test
    void redefinirSenhaRegistraGestorAfetadoEAcao() {
        servico.redefinirSenha(gestor, OPERADOR, "nova-senha-123");

        AuditoriaUsuario registro = registroGravado();
        assertThat(registro.getGestorId()).isEqualTo(GESTOR);
        assertThat(registro.getUsuarioAfetadoId()).isEqualTo(OPERADOR);
        assertThat(registro.getAcao()).isEqualTo(AcaoAuditoria.REDEFINICAO_SENHA);
    }

    @Test
    void desativarEReativarRegistramAAcaoCerta() {
        servico.definirAtivo(gestor, OPERADOR, false);
        assertThat(registroGravado().getAcao()).isEqualTo(AcaoAuditoria.DESATIVACAO_USUARIO);

        servico.definirAtivo(gestor, OPERADOR, true);
        ArgumentCaptor<AuditoriaUsuario> c = ArgumentCaptor.forClass(AuditoriaUsuario.class);
        verify(auditoria, org.mockito.Mockito.times(2)).saveAndFlush(c.capture());
        assertThat(c.getAllValues().get(1).getAcao()).isEqualTo(AcaoAuditoria.REATIVACAO_USUARIO);
    }

    @Test
    void acaoRecusadaNaoGeraAuditoria() {
        assertThatThrownBy(() -> servico.redefinirSenha(gestor, GESTOR, "nova-senha-123")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> servico.redefinirSenha(gestor, ADMIN, "nova-senha-123")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> servico.definirAtivo(gestor, ADMIN, false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> servico.redefinirSenha(gestor, OPERADOR, "x".repeat(80))).isInstanceOf(ApiException.class);
        verify(auditoria, never()).saveAndFlush(any());
    }

    @Test
    void criarUsuarioFicaNaAuditoria() {
        when(usuarios.save(any())).thenAnswer(i -> {
            Usuario u = i.getArgument(0);
            ReflectionTestUtils.setField(u, "id", 9);
            return u;
        });

        servico.criar(gestor, new NovoUsuarioDTO("Nova Pessoa", "nova", Perfil.operador, "senha-forte-123"));

        ArgumentCaptor<AuditoriaUsuario> c = ArgumentCaptor.forClass(AuditoriaUsuario.class);
        verify(auditoria).saveAndFlush(c.capture());
        assertThat(c.getValue().getAcao()).isEqualTo(AcaoAuditoria.CRIACAO_USUARIO);
        assertThat(c.getValue().getGestorId()).isEqualTo(GESTOR);
        assertThat(c.getValue().getUsuarioAfetadoId()).isEqualTo(9);
    }

    @Test
    void registroNaoTemCampoDeSenha() {
        assertThat(Arrays.stream(AuditoriaUsuario.class.getDeclaredFields()).map(Field::getName))
                .containsExactlyInAnyOrder("id", "gestorId", "usuarioAfetadoId", "acao", "dataHora")
                .noneMatch(nome -> nome.toLowerCase().contains("senha") || nome.toLowerCase().contains("hash"));
    }

    private AuditoriaUsuario registroGravado() {
        ArgumentCaptor<AuditoriaUsuario> c = ArgumentCaptor.forClass(AuditoriaUsuario.class);
        verify(auditoria).saveAndFlush(c.capture());
        return c.getValue();
    }

    private static Usuario usuario(int id, String login, Perfil perfil) {
        Usuario u = new Usuario("Pessoa " + id, login, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }
}
