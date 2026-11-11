package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.config.AdminProperties;
import br.com.aguas.dto.UsuarioDTOs.TokenDeApiDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.AuditoriaUsuarioRepository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.TokenDeApi;
import br.com.aguas.security.UsuarioAutenticado;

/** Rotação do token de API pelo administrador, sem banco. */
class RotacaoTokenTest {

    static final int ADMIN = 1;
    static final int SENSOR = 2;
    static final int OPERADOR = 3;

    UsuarioRepository usuarios = mock(UsuarioRepository.class);
    AuditoriaUsuarioRepository auditoria = mock(AuditoriaUsuarioRepository.class);
    UsuarioService servico = new UsuarioService(usuarios, new BCryptPasswordEncoder(4),
            new AdminProperties("capibaribe.admin", null, null), auditoria);
    UsuarioAutenticado admin = new UsuarioAutenticado(ADMIN, Perfil.admin);
    Usuario sensor = usuario(SENSOR, "sensor.wokwi", Perfil.sensor);

    @BeforeEach
    void contas() {
        when(usuarios.findById(SENSOR)).thenReturn(Optional.of(sensor));
        when(usuarios.findById(OPERADOR)).thenReturn(Optional.of(usuario(OPERADOR, "joao", Perfil.operador)));
    }

    @Test
    void geraChaveDe64CaracteresEGuardaSoOHash() {
        TokenDeApiDTO resposta = servico.rotacionarToken(admin, SENSOR);

        assertThat(resposta.token()).matches("[A-Za-z0-9]{64}");
        assertThat(resposta.usuario().id()).isEqualTo(SENSOR);
        assertThat(sensor.getTokenHash()).isEqualTo(TokenDeApi.hash(resposta.token())).isNotEqualTo(resposta.token());
    }

    @Test
    void novaRotacaoSubstituiOHashAnterior() {
        String primeira = servico.rotacionarToken(admin, SENSOR).token();
        String hashDaPrimeira = sensor.getTokenHash();

        String segunda = servico.rotacionarToken(admin, SENSOR).token();

        assertThat(segunda).isNotEqualTo(primeira);
        // Só existe um hash por conta: o da chave anterior some, e ela não autentica mais ninguém.
        assertThat(sensor.getTokenHash()).isEqualTo(TokenDeApi.hash(segunda)).isNotEqualTo(hashDaPrimeira);
    }

    @Test
    void rotacaoFicaNaAuditoria() {
        servico.rotacionarToken(admin, SENSOR);

        ArgumentCaptor<AuditoriaUsuario> c = ArgumentCaptor.forClass(AuditoriaUsuario.class);
        verify(auditoria).saveAndFlush(c.capture());
        AuditoriaUsuario registro = c.getValue();
        assertThat(registro.getGestorId()).isEqualTo(ADMIN);
        assertThat(registro.getUsuarioAfetadoId()).isEqualTo(SENSOR);
        assertThat(registro.getAcao()).isEqualTo(AcaoAuditoria.ROTACAO_TOKEN);
    }

    @Test
    void contaQueNaoEDeSensorOuNaoExisteERecusadaSemAuditoria() {
        assertThatThrownBy(() -> servico.rotacionarToken(admin, OPERADOR))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> servico.rotacionarToken(admin, 99))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(auditoria, never()).saveAndFlush(any());
    }

    private static Usuario usuario(int id, String login, Perfil perfil) {
        Usuario u = new Usuario("Pessoa " + id, login, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }
}
