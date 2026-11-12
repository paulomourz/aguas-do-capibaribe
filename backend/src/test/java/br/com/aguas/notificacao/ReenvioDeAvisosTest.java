package br.com.aguas.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.AlertaLote;
import br.com.aguas.entity.AvisoPendente;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.repository.AlertaLoteRepository;
import br.com.aguas.repository.AlertaRepository;
import br.com.aguas.repository.AvisoPendenteRepository;
import br.com.aguas.repository.ProcessoRepository;

/** Reenvio dos avisos pendentes (#97): uma tentativa por rodada, marca o enviado e para no limite. Sem banco. */
class ReenvioDeAvisosTest {

    static final OffsetDateTime AGORA = OffsetDateTime.of(2026, 11, 12, 15, 0, 0, 0, ZoneOffset.UTC);
    static final Clock RELOGIO = Clock.fixed(Instant.from(AGORA), ZoneOffset.UTC);

    Telegram telegram = mock(Telegram.class);
    AvisoPendenteRepository pendentes = mock(AvisoPendenteRepository.class);
    AlertaRepository alertas = mock(AlertaRepository.class);
    ProcessoRepository processos = mock(ProcessoRepository.class);
    AlertaLoteRepository vinculos = mock(AlertaLoteRepository.class);
    TelegramProperties props = new TelegramProperties("t", "1", null, null, Duration.ZERO, Duration.ofMinutes(5), Duration.ofHours(24));
    ReenvioDeAvisos reenvio = new ReenvioDeAvisos(telegram, props, new AvisoDeAlerta(telegram, props, pendentes, t -> {}),
            pendentes, alertas, processos, vinculos, RELOGIO);

    @BeforeEach
    void telegramLigado() {
        when(telegram.configurado()).thenReturn(true);
    }

    private static AvisoPendente pendente(int alertaId, OffsetDateTime criadoEm) {
        AvisoPendente p = new AvisoPendente(alertaId, 3, "HTTP 500");
        ReflectionTestUtils.setField(p, "criadoEm", criadoEm);
        return p;
    }

    private void alerta(int id, StatusAlerta status) {
        Alerta a = mock(Alerta.class);
        when(a.getId()).thenReturn(id);
        when(a.getProcessoId()).thenReturn(4);
        when(a.getStatus()).thenReturn(status);
        when(alertas.findById(id)).thenReturn(Optional.of(a));
        when(vinculos.findByAlertaIdIn(List.of(id))).thenReturn(List.of(new AlertaLote(12, id), new AlertaLote(10, id), new AlertaLote(11, id)));
    }

    private void naFila(AvisoPendente... lista) {
        when(pendentes.findByEnviadoEmIsNullAndCriadoEmAfterOrderByIdAsc(any())).thenReturn(List.of(lista));
    }

    @BeforeEach
    void processo() {
        Processo p = mock(Processo.class);
        when(p.getNome()).thenReturn("Estonagem");
        when(processos.findById(4)).thenReturn(Optional.of(p));
    }

    @Test
    void semTelegramConfiguradoNemOlhaATabela() {
        when(telegram.configurado()).thenReturn(false);

        reenvio.reenviarPendentes();

        verifyNoInteractions(pendentes);
        verify(telegram, never()).enviar(anyString());
    }

    @Test
    void procuraSoOsPendentesDentroDoLimite() {
        naFila();

        reenvio.reenviarPendentes();

        verify(pendentes).findByEnviadoEmIsNullAndCriadoEmAfterOrderByIdAsc(AGORA.minusHours(24));
    }

    @Test
    void telegramDeVoltaEnviaOAvisoAtrasadoEMarcaEnviado() {
        AvisoPendente p = pendente(7, AGORA.minusHours(1));
        alerta(7, StatusAlerta.aberto);
        naFila(p);

        reenvio.reenviarPendentes();

        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(telegram).enviar(texto.capture());
        assertThat(texto.getValue()).startsWith("Aviso atrasado")
                .contains("Processo: Estonagem", "#10, #11, #12", "Alerta #7 aberto.");
        assertThat(p.getEnviadoEm()).isEqualTo(AGORA);
        assertThat(p.getTentativas()).isEqualTo(4);
        verify(pendentes).save(p);
    }

    @Test
    void telegramAindaForaDoArContaATentativaEParaARodada() {
        AvisoPendente primeiro = pendente(7, AGORA.minusHours(1));
        AvisoPendente segundo = pendente(8, AGORA.minusMinutes(30));
        alerta(7, StatusAlerta.aberto);
        alerta(8, StatusAlerta.aberto);
        naFila(primeiro, segundo);
        doThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE)).when(telegram).enviar(anyString());

        reenvio.reenviarPendentes();

        // Uma chamada só: com o Telegram fora do ar, não adianta tentar o segundo nesta rodada.
        verify(telegram, times(1)).enviar(anyString());
        assertThat(primeiro.getEnviadoEm()).isNull();
        assertThat(primeiro.getTentativas()).isEqualTo(4);
        assertThat(primeiro.getUltimoErro()).isEqualTo("HTTP 503");
        verify(pendentes).save(primeiro);
        verify(pendentes, never()).save(segundo);
    }

    @Test
    void erroDeRedeGuardaSoOTipoNuncaOToken() {
        AvisoPendente p = pendente(7, AGORA.minusHours(1));
        alerta(7, StatusAlerta.aberto);
        naFila(p);
        doThrow(new ResourceAccessException("I/O error on POST https://api.telegram.org/botSEGREDO/sendMessage"))
                .when(telegram).enviar(anyString());

        reenvio.reenviarPendentes();

        assertThat(p.getUltimoErro()).isEqualTo("ResourceAccessException").doesNotContain("SEGREDO");
    }

    @Test
    void alertaQueNaoEstaMaisAbertoNaoGeraAvisoAtrasado() {
        AvisoPendente emAnalise = pendente(7, AGORA.minusHours(2));
        AvisoPendente aberto = pendente(8, AGORA.minusHours(1));
        alerta(7, StatusAlerta.analise);
        alerta(8, StatusAlerta.aberto);
        naFila(emAnalise, aberto);

        reenvio.reenviarPendentes();

        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(telegram, times(1)).enviar(texto.capture());
        assertThat(texto.getValue()).contains("Alerta #8");
        assertThat(emAnalise.getEnviadoEm()).isNull();
        assertThat(emAnalise.getTentativas()).isEqualTo(3);
        verify(pendentes, never()).save(emAnalise);
    }

    @Test
    void falhaAoLerATabelaNaoDerrubaARotina() {
        when(pendentes.findByEnviadoEmIsNullAndCriadoEmAfterOrderByIdAsc(any())).thenThrow(new IllegalStateException("banco fora"));

        assertThatCode(reenvio::reenviarPendentes).doesNotThrowAnyException();
        verify(telegram, never()).enviar(anyString());
    }

    @Test
    void falhaNoBancoAoMontarAMensagemNaoContaComoTentativaDoTelegram() {
        AvisoPendente p = pendente(7, AGORA.minusHours(1));
        naFila(p);
        when(alertas.findById(7)).thenThrow(new IllegalStateException("banco fora"));

        assertThatCode(reenvio::reenviarPendentes).doesNotThrowAnyException();
        verify(telegram, never()).enviar(anyString());
        assertThat(p.getTentativas()).isEqualTo(3);
        assertThat(p.getUltimoErro()).isEqualTo("HTTP 500");
        verify(pendentes, never()).save(any());
    }

    @Test
    void falhaAoGravarATentativaNaoDerrubaARotina() {
        AvisoPendente p = pendente(7, AGORA.minusHours(1));
        alerta(7, StatusAlerta.aberto);
        naFila(p);
        when(pendentes.save(any())).thenThrow(new IllegalStateException("sem permissão"));

        assertThatCode(reenvio::reenviarPendentes).doesNotThrowAnyException();
        verify(telegram).enviar(anyString());
    }

    @Test
    void ultimaTentativaEQuandoAProximaRodadaJaPassariaDoLimite() {
        // Limite de 24 h e rodada a cada 5 min.
        assertThat(reenvio.ultimaTentativa(pendente(7, AGORA.minusHours(23)), AGORA)).isFalse();
        assertThat(reenvio.ultimaTentativa(pendente(7, AGORA.minusHours(24).plusMinutes(6)), AGORA)).isFalse();
        assertThat(reenvio.ultimaTentativa(pendente(7, AGORA.minusHours(24).plusMinutes(5)), AGORA)).isTrue();
        assertThat(reenvio.ultimaTentativa(pendente(7, AGORA.minusHours(24).plusMinutes(1)), AGORA)).isTrue();
    }

    @Test
    void padroesDoReenvio() {
        var semValores = new TelegramProperties("t", "1", null, null, null, null, null);
        assertThat(semValores.reenvioACadaOuPadrao()).isEqualTo(Duration.ofMinutes(5));
        assertThat(semValores.reenvioLimiteOuPadrao()).isEqualTo(Duration.ofHours(24));
    }
}
