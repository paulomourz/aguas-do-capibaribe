package br.com.aguas.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.entity.Lote;
import br.com.aguas.entity.Perfil;
import br.com.aguas.repository.LoteRepository;

/** Saúde do sensor do Wokwi no Actuator (issue #158), com o repositório simulado e um relógio fixo. */
class SensorWokwiHealthIndicatorTest {

    /** Hora fixa: o tempo decorrido não depende do momento em que o teste roda. */
    private static final OffsetDateTime AGORA = OffsetDateTime.parse("2026-11-20T14:00:00Z");
    private static final Duration JANELA = Duration.ofSeconds(60);

    private final LoteRepository lotes = mock(LoteRepository.class);
    private final SensorWokwiHealthIndicator saude =
            new SensorWokwiHealthIndicator(lotes, JANELA, Clock.fixed(AGORA.toInstant(), ZoneOffset.UTC));

    /** Lote de sensor registrado há {@code atras}. O registrado_em vem do banco, por isso é preenchido por reflexão. */
    private Health saudeComUltimoLoteHa(Duration atras) {
        Lote lote = new Lote(7, 4, 50, new BigDecimal("612.50"));
        ReflectionTestUtils.setField(lote, "id", 123);
        ReflectionTestUtils.setField(lote, "registradoEm", AGORA.minus(atras));
        when(lotes.ultimosLotesDoPerfil(eq(Perfil.sensor), any(Limit.class))).thenReturn(List.of(lote));
        return saude.health();
    }

    @Test
    void leituraDentroDaJanelaFicaUpComOHorarioDaUltimaLeitura() {
        Health h = saudeComUltimoLoteHa(Duration.ofSeconds(10));

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails())
                .containsEntry("ultimaLeitura", "2026-11-20T13:59:50Z")
                .containsEntry("segundosSemEnviar", 10L)
                .containsEntry("janelaSegundos", 60L)
                .containsEntry("processoId", 7)
                .containsEntry("loteId", 123);
    }

    @Test
    void leituraAcimaDaJanelaFicaDownComOTempoDecorrido() {
        Health h = saudeComUltimoLoteHa(Duration.ofMinutes(5));

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails())
                .containsEntry("segundosSemEnviar", 300L)
                .containsEntry("janelaSegundos", 60L);
    }

    @Test
    void noLimiteExatoDaJanelaAindaFicaUp() {
        // A issue pede DOWN quando o tempo excede a janela; com 60 s exatos ele não excedeu ainda.
        assertThat(saudeComUltimoLoteHa(JANELA).getStatus()).isEqualTo(Status.UP);
        assertThat(saudeComUltimoLoteHa(JANELA.plusSeconds(1)).getStatus()).isEqualTo(Status.DOWN);
    }

    @Test
    void relogiosForaDeSincroniaNaoGeramTempoNegativo() {
        Health h = saudeComUltimoLoteHa(Duration.ofSeconds(-2));

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsEntry("segundosSemEnviar", 0L);
    }

    @Test
    void bancoSemLoteDeSensorFicaUnknownENaoDerrubaASaudeDaApi() {
        when(lotes.ultimosLotesDoPerfil(eq(Perfil.sensor), any(Limit.class))).thenReturn(List.of());

        Health h = saude.health();

        // UNKNOWN, e não DOWN: nenhum lote ainda não é falha do sensor, e DOWN faria /actuator/health
        // responder 503, o que o Render entende como API fora do ar.
        assertThat(h.getStatus()).isEqualTo(Status.UNKNOWN);
        assertThat(h.getDetails()).containsKey("motivo");
    }

    @Test
    void consultaApenasOUltimoLoteDeContasDePerfilSensor() {
        saudeComUltimoLoteHa(Duration.ofSeconds(10));

        ArgumentCaptor<Limit> limite = ArgumentCaptor.forClass(Limit.class);
        verify(lotes).ultimosLotesDoPerfil(eq(Perfil.sensor), limite.capture());
        assertThat(limite.getValue().max()).isEqualTo(1);
    }
}
