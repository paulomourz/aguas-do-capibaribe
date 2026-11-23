package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.dto.DescarteDTOs.DescarteDTO;
import br.com.aguas.dto.DescarteDTOs.NovoDescarteDTO;
import br.com.aguas.entity.DescarteEfluente;
import br.com.aguas.entity.Lote;
import br.com.aguas.entity.Perfil;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.DescarteEfluenteRepository;
import br.com.aguas.repository.LoteRepository;
import br.com.aguas.security.UsuarioAutenticado;

/** Regra de acesso e gravação do descarte de efluentes (issue #201), sem banco. */
class DescarteServiceTest {

    private static final int DONO = 4;
    private static final UsuarioAutenticado OPERADOR_DONO = new UsuarioAutenticado(DONO, Perfil.operador);
    private static final UsuarioAutenticado OUTRO_OPERADOR = new UsuarioAutenticado(9, Perfil.operador);
    private static final UsuarioAutenticado GESTOR = new UsuarioAutenticado(3, Perfil.gestor);
    private static final NovoDescarteDTO SEM_REUSO =
            new NovoDescarteDTO(new BigDecimal("200"), new BigDecimal("7.5"), new BigDecimal("12"), null);

    private DescarteEfluenteRepository descartes;
    private LoteRepository lotes;
    private DescarteService servico;

    @BeforeEach
    void preparar() {
        descartes = mock(DescarteEfluenteRepository.class);
        lotes = mock(LoteRepository.class);
        servico = new DescarteService(descartes, lotes);
        Lote lote = new Lote(1, DONO, 10, new BigDecimal("100"));
        ReflectionTestUtils.setField(lote, "id", 10);
        when(lotes.findById(10)).thenReturn(Optional.of(lote));
        when(lotes.findById(99)).thenReturn(Optional.empty());
        when(descartes.saveAndFlush(any())).thenAnswer(i -> {
            DescarteEfluente d = i.getArgument(0);
            ReflectionTestUtils.setField(d, "id", 1);
            ReflectionTestUtils.setField(d, "dataDescarte", OffsetDateTime.parse("2026-11-23T12:00:00-03:00"));
            return d;
        });
    }

    @Test
    void gravaNoLoteComOReaproveitamentoZeroQuandoNaoInformado() {
        DescarteDTO dto = servico.registrar(OPERADOR_DONO, 10, SEM_REUSO);

        ArgumentCaptor<DescarteEfluente> gravado = ArgumentCaptor.forClass(DescarteEfluente.class);
        verify(descartes).saveAndFlush(gravado.capture());
        assertThat(gravado.getValue().getLoteId()).isEqualTo(10);
        assertThat(gravado.getValue().getReutilizadoPercentual()).isEqualByComparingTo("0");
        assertThat(dto.id()).isEqualTo(1);
        assertThat(dto.ph()).isEqualByComparingTo("7.5");
        assertThat(dto.data()).isEqualTo(OffsetDateTime.parse("2026-11-23T12:00:00-03:00").toInstant());
    }

    @Test
    void gestorAlcancaOLoteDeQualquerOperador() {
        servico.registrar(GESTOR, 10, SEM_REUSO);
        verify(descartes).saveAndFlush(any());
    }

    @Test
    void operadorNaoAlcancaLoteDeOutraPessoaNemParaListar() {
        assertThatThrownBy(() -> servico.registrar(OUTRO_OPERADOR, 10, SEM_REUSO))
                .isInstanceOf(ApiException.class).hasMessage("Lote não encontrado.");
        assertThatThrownBy(() -> servico.listar(OUTRO_OPERADOR, 10)).isInstanceOf(ApiException.class);
        verify(descartes, never()).saveAndFlush(any());
    }

    @Test
    void loteInexistenteResponde404() {
        assertThatThrownBy(() -> servico.registrar(GESTOR, 99, SEM_REUSO)).isInstanceOf(ApiException.class);
    }

    @Test
    void listaNaOrdemDoRepositorio() {
        DescarteEfluente d = new DescarteEfluente(10, new BigDecimal("50"), new BigDecimal("8"), BigDecimal.ONE, BigDecimal.TEN);
        ReflectionTestUtils.setField(d, "id", 2);
        ReflectionTestUtils.setField(d, "dataDescarte", OffsetDateTime.parse("2026-11-23T10:00:00-03:00"));
        when(descartes.findByLoteIdOrderByDataDescarteDescIdDesc(10)).thenReturn(List.of(d));

        assertThat(servico.listar(OPERADOR_DONO, 10)).extracting(DescarteDTO::id).containsExactly(2);
    }
}
