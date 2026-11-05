package br.com.aguas.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

/** Aviso de alerta no Telegram, sem rede. */
class AvisoDeAlertaTest {

    Telegram telegram = mock(Telegram.class);
    AlertaAberto alerta = new AlertaAberto(7, "Estonagem", List.of(10, 11, 12));

    private AvisoDeAlerta aviso(String siteUrl) {
        return new AvisoDeAlerta(telegram, new TelegramProperties("t", "1", null, siteUrl));
    }

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
    void desligadoNaoEnviaNada() {
        when(telegram.configurado()).thenReturn(false);

        aviso(null).aoAbrir(alerta);

        verify(telegram, never()).enviar(anyString());
    }

    @Test
    void falhaNoEnvioNaoSobeParaQuemRegistrouOLote() {
        when(telegram.configurado()).thenReturn(true);
        doThrow(new ResourceAccessException("I/O error on POST https://api.telegram.org/botSEGREDO/sendMessage"))
                .when(telegram).enviar(anyString());

        assertThatCode(() -> aviso(null).aoAbrir(alerta)).doesNotThrowAnyException();
    }
}
