package br.com.aguas.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.ServerSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import br.com.aguas.entity.AvisoPendente;
import br.com.aguas.repository.AvisoPendenteRepository;

/** Aviso de alerta no Telegram: mensagem, novas tentativas e aviso pendente. Sem banco e sem esperar de verdade. */
class AvisoDeAlertaTest {

    static final Duration ESPERA = Duration.ofMillis(700);

    Telegram telegram = mock(Telegram.class);
    AvisoPendenteRepository pendentes = mock(AvisoPendenteRepository.class);
    List<Duration> pausas = new ArrayList<>();
    AlertaAberto alerta = new AlertaAberto(7, "Estonagem", List.of(10, 11, 12));

    private AvisoDeAlerta aviso(String siteUrl) {
        return new AvisoDeAlerta(telegram, new TelegramProperties("t", "1", null, siteUrl, ESPERA, null, null), pendentes, pausas::add);
    }

    private static ResourceAccessException erroDeRede() {
        return new ResourceAccessException("I/O error on POST https://api.telegram.org/botSEGREDO/sendMessage");
    }

    private AvisoPendente pendenteGravado() {
        ArgumentCaptor<AvisoPendente> c = ArgumentCaptor.forClass(AvisoPendente.class);
        verify(pendentes).save(c.capture());
        return c.getValue();
    }

    // ---------- mensagem ----------

    @Test
    void mensagemTrazProcessoLotesELinkDoAlerta() {
        String texto = aviso("https://aguas.exemplo.com/").texto(alerta);

        assertThat(texto).contains("Processo: Estonagem", "#10, #11, #12", "Alerta #7")
                .endsWith("https://aguas.exemplo.com/#/alertas/7");
    }

    @Test
    void semEnderecoDoSiteAMensagemNaoTemLink() {
        assertThat(aviso("").texto(alerta)).doesNotContain("http");
    }

    @Test
    void desligadoNaoEnviaNemGuardaNada() {
        when(telegram.configurado()).thenReturn(false);

        aviso(null).aoAbrir(alerta);

        verify(telegram, never()).enviar(anyString());
        verify(pendentes, never()).save(any());
    }

    // ---------- tentativas ----------

    @Test
    void envioQueDaCertoNaPrimeiraNaoTentaDeNovoNemFicaPendente() {
        when(telegram.configurado()).thenReturn(true);
        AvisoDeAlerta aviso = aviso(null);

        aviso.aoAbrir(alerta);

        verify(telegram, times(1)).enviar(aviso.texto(alerta));
        assertThat(pausas).isEmpty();
        verify(pendentes, never()).save(any());
    }

    @Test
    void erroDeRedeNaPrimeiraTentativaEEnvioNaSegunda() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(erroDeRede()).doNothing().when(telegram).enviar(anyString());

        aviso(null).aoAbrir(alerta);

        verify(telegram, times(2)).enviar(anyString());
        assertThat(pausas).containsExactly(ESPERA);
        verify(pendentes, never()).save(any());
    }

    @Test
    void erroDeRedeNasDuasPrimeirasEEnvioNaTerceira() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(erroDeRede()).doThrow(erroDeRede()).doNothing().when(telegram).enviar(anyString());

        aviso(null).aoAbrir(alerta);

        verify(telegram, times(3)).enviar(anyString());
        assertThat(pausas).containsExactly(ESPERA, ESPERA);
        verify(pendentes, never()).save(any());
    }

    @Test
    void erroDeRedeQuePersisteFaz3TentativasEGuardaComoPendente() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(erroDeRede()).when(telegram).enviar(anyString());

        assertThatCode(() -> aviso(null).aoAbrir(alerta)).doesNotThrowAnyException();

        // 3 envios no total, com pausa só entre eles (não depois do último).
        verify(telegram, times(3)).enviar(anyString());
        assertThat(pausas).containsExactly(ESPERA, ESPERA);
        AvisoPendente pendente = pendenteGravado();
        assertThat(pendente.getAlertaId()).isEqualTo(7);
        assertThat(pendente.getTentativas()).isEqualTo(3);
        // Só o tipo do erro: a mensagem da exceção traz a URL com o token.
        assertThat(pendente.getUltimoErro()).isEqualTo("ResourceAccessException").doesNotContain("SEGREDO");
    }

    @Test
    void telegramRecusandoTambemFaz3TentativasEGuardaOStatusHttp() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(new HttpServerErrorException(HttpStatus.BAD_GATEWAY)).when(telegram).enviar(anyString());

        aviso(null).aoAbrir(alerta);

        verify(telegram, times(3)).enviar(anyString());
        AvisoPendente pendente = pendenteGravado();
        assertThat(pendente.getTentativas()).isEqualTo(3);
        assertThat(pendente.getUltimoErro()).isEqualTo("HTTP 502");
    }

    @Test
    void pendenteGuardaOErroDaUltimaTentativa() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(new HttpServerErrorException(HttpStatus.BAD_GATEWAY)).doThrow(erroDeRede()).doThrow(erroDeRede())
                .when(telegram).enviar(anyString());

        aviso(null).aoAbrir(alerta);

        assertThat(pendenteGravado().getUltimoErro()).isEqualTo("ResourceAccessException");
    }

    @Test
    void interrupcaoNaEsperaParaAsTentativasEGuardaComoPendente() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(erroDeRede()).when(telegram).enviar(anyString());
        AvisoDeAlerta aviso = new AvisoDeAlerta(telegram, new TelegramProperties("t", "1", null, null, ESPERA, null, null), pendentes,
                tempo -> { throw new InterruptedException(); });

        aviso.aoAbrir(alerta);

        // A thread continua marcada como interrompida, para quem a controla saber (e a marca é limpa aqui).
        assertThat(Thread.interrupted()).isTrue();
        verify(telegram, times(1)).enviar(anyString());
        assertThat(pendenteGravado().getTentativas()).isEqualTo(1);
    }

    @Test
    void falhaAoGuardarOPendenteNaoSobeParaQuemRegistrouOLote() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(erroDeRede()).when(telegram).enviar(anyString());
        when(pendentes.save(any())).thenThrow(new IllegalStateException("banco fora do ar"));

        assertThatCode(() -> aviso(null).aoAbrir(alerta)).doesNotThrowAnyException();

        verify(telegram, times(3)).enviar(anyString());
    }

    @Test
    void erroDeRedeDeVerdadeViraPendente() throws Exception {
        // Porta que acabou de ser fechada: a conexão é recusada, como num Telegram inalcançável.
        int porta;
        try (ServerSocket livre = new ServerSocket(0)) {
            porta = livre.getLocalPort();
        }
        var props = new TelegramProperties("token-de-teste", "1", "http://localhost:" + porta, null, ESPERA, null, null);
        AvisoDeAlerta aviso = new AvisoDeAlerta(new Telegram(props, RestClient.builder()), props, pendentes, pausas::add);

        aviso.aoAbrir(alerta);

        assertThat(pausas).containsExactly(ESPERA, ESPERA);
        AvisoPendente pendente = pendenteGravado();
        assertThat(pendente.getTentativas()).isEqualTo(3);
        assertThat(pendente.getUltimoErro()).isEqualTo("ResourceAccessException");
    }

    // ---------- configuração ----------

    @Test
    void esperaEntreTentativasTemPadraoDe2Segundos() {
        assertThat(new TelegramProperties("t", "1", null, null, null, null, null).esperaOuPadrao()).isEqualTo(Duration.ofSeconds(2));
        assertThat(new TelegramProperties("t", "1", null, null, ESPERA, null, null).esperaOuPadrao()).isEqualTo(ESPERA);
    }
}
