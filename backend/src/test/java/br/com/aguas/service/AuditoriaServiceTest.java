package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.dto.AuditoriaDTOs.PaginaAuditoriaDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.AuditoriaUsuarioRepository;
import br.com.aguas.repository.UsuarioRepository;

/** Consulta da auditoria, sem banco. */
class AuditoriaServiceTest {

    AuditoriaUsuarioRepository auditoria = mock(AuditoriaUsuarioRepository.class);
    UsuarioRepository usuarios = mock(UsuarioRepository.class);
    AuditoriaService servico = new AuditoriaService(auditoria, usuarios);

    private static Usuario usuario(int id, String login) {
        Usuario u = new Usuario("Pessoa " + id, login, "x".repeat(60), Perfil.gestor);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static AuditoriaUsuario registro(int id, int gestor, int afetado, AcaoAuditoria acao) {
        AuditoriaUsuario r = new AuditoriaUsuario(gestor, afetado, acao);
        ReflectionTestUtils.setField(r, "id", id);
        ReflectionTestUtils.setField(r, "dataHora", OffsetDateTime.parse("2026-11-03T10:00:00-03:00"));
        return r;
    }

    @Test
    @SuppressWarnings("unchecked")
    void devolveAPaginaComOsNomesDasPessoasEOsMaisRecentesPrimeiro() {
        when(auditoria.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(registro(9, 1, 2, AcaoAuditoria.REDEFINICAO_SENHA)), PageRequest.of(1, 20), 21));
        when(usuarios.findAllById(Set.of(1, 2))).thenReturn(List.of(usuario(1, "gestora"), usuario(2, "joao")));

        PaginaAuditoriaDTO pagina = servico.listar(null, null, null, 1, 20);

        assertThat(pagina.total()).isEqualTo(21);
        assertThat(pagina.pagina()).isEqualTo(1);
        var item = pagina.itens().getFirst();
        assertThat(item.acao()).isEqualTo(AcaoAuditoria.REDEFINICAO_SENHA);
        assertThat(item.gestor().usuario()).isEqualTo("gestora");
        assertThat(item.usuarioAfetado().nome()).isEqualTo("Pessoa 2");

        ArgumentCaptor<Pageable> paginacao = ArgumentCaptor.forClass(Pageable.class);
        verify(auditoria).findAll(any(Specification.class), paginacao.capture());
        assertThat(paginacao.getValue().getSort())
                .isEqualTo(Sort.by(Sort.Order.desc("dataHora"), Sort.Order.desc("id")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void paginaVaziaNaoQuebra() {
        when(auditoria.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        PaginaAuditoriaDTO pagina = servico.listar(null, null, AcaoAuditoria.CRIACAO_USUARIO, 0, 20);

        assertThat(pagina.itens()).isEmpty();
        assertThat(pagina.total()).isZero();
    }
}
