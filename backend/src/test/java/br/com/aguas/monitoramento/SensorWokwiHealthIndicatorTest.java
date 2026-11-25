package br.com.aguas.monitoramento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.dao.DataAccessResourceFailureException;

import br.com.aguas.dto.UltimaLeituraDTO;
import br.com.aguas.repository.TelemetriaRepository;

/**
 * Issue #158 (RNF03): Given o operador consultando a saúde do sensor, When a última leitura do ESP32 chegou há
 * menos de 60 s, Then sensorWokwi está UP com a hora da última leitura; passou de 60 s, DOWN.
 */
class SensorWokwiHealthIndicatorTest {

    private static final Instant AGORA = Instant.parse("2026-11-18T15:00:00Z");
    private static final Duration LIMITE = Duration.ofSeconds(60);

    private final TelemetriaRepository telemetrias = mock(TelemetriaRepository.class);
    private final SensorWokwiHealthIndicator indicador =
            new SensorWokwiHealthIndicator(telemetrias, LIMITE, Clock.fixed(AGORA, ZoneOffset.UTC));

    private static OffsetDateTime haSegundos(long s) {
        return OffsetDateTime.ofInstant(AGORA.minusSeconds(s), ZoneOffset.UTC);
    }

    private void ultimaLeituraHa(long segundos, UltimaLeituraDTO... linhas) {
        when(telemetrias.ultimaLeitura()).thenReturn(haSegundos(segundos));
        when(telemetrias.ultimaLeituraPorLinhaAtiva(any())).thenReturn(List.of(linhas));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> linhas(Health h) {
        return (List<Map<String, Object>>) h.getDetails().get("linhasAtivas");
    }

    @Test
    void leituraHaMenosDe60sEstaUpComAHoraDaUltimaLeitura() {
        ultimaLeituraHa(10, new UltimaLeituraDTO(1, "Estonagem", haSegundos(10)));

        Health h = indicador.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails())
                .containsEntry("ultimaLeitura", "2026-11-18T14:59:50Z")
                .containsEntry("segundosDesdeUltimaLeitura", 10L)
                .containsEntry("limiteSemLeituraSegundos", 60L)
                .doesNotContainKey("motivo");
        assertThat(linhas(h)).singleElement().satisfies(l -> assertThat(l)
                .containsEntry("processoId", 1)
                .containsEntry("processo", "Estonagem")
                .containsEntry("status", "UP")
                .containsEntry("ultimaLeitura", "2026-11-18T14:59:50Z")
                .containsEntry("segundosDesdeUltimaLeitura", 10L));
    }

    @Test
    void leitura59sAtrasAindaEstaUp() {
        ultimaLeituraHa(59);
        assertThat(indicador.health().getStatus()).isEqualTo(Status.UP);
    }

    @Test
    void exatamente60sJaEstaDown() {
        ultimaLeituraHa(60);
        assertThat(indicador.health().getStatus()).isEqualTo(Status.DOWN);
    }

    @Test
    void leituraHaMaisDe60sEstaDownComOTempoDecorrido() {
        ultimaLeituraHa(185, new UltimaLeituraDTO(2, "Tingimento", haSegundos(185)));

        Health h = indicador.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails())
                .containsEntry("ultimaLeitura", "2026-11-18T14:56:55Z")
                .containsEntry("segundosDesdeUltimaLeitura", 185L)
                .containsEntry("motivo", "Sem leitura há 185 s (limite de 60 s).");
        assertThat(linhas(h)).singleElement().satisfies(l -> assertThat(l).containsEntry("status", "DOWN"));
    }

    @Test
    void cadaLinhaAtivaTemOProprioStatus() {
        ultimaLeituraHa(5,
                new UltimaLeituraDTO(1, "Estonagem", haSegundos(5)),
                new UltimaLeituraDTO(3, "Amaciamento", haSegundos(3600)));

        Health h = indicador.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(linhas(h)).extracting(l -> l.get("processo"), l -> l.get("status"))
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Estonagem", "UP"),
                        org.assertj.core.groups.Tuple.tuple("Amaciamento", "DOWN"));
    }

    @Test
    void linhasAtivasSaoAsComLeituraNasUltimas24Horas() {
        ultimaLeituraHa(1);
        indicador.health();
        verify(telemetrias).ultimaLeituraPorLinhaAtiva(OffsetDateTime.parse("2026-11-17T15:00:00Z"));
    }

    @Test
    void semNenhumaLeituraEstaDown() {
        when(telemetrias.ultimaLeitura()).thenReturn(null);

        Health h = indicador.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails())
                .containsEntry("motivo", "Nenhuma leitura de telemetria registrada.")
                .doesNotContainKeys("ultimaLeitura", "linhasAtivas");
        verify(telemetrias, never()).ultimaLeituraPorLinhaAtiva(any());
    }

    @Test
    void relogioDoServidorAtrasDoBancoNaoDaTempoNegativo() {
        when(telemetrias.ultimaLeitura()).thenReturn(OffsetDateTime.ofInstant(AGORA.plusSeconds(2), ZoneOffset.UTC));
        Health h = indicador.health();
        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsEntry("segundosDesdeUltimaLeitura", 0L);
    }

    @Test
    void bancoForaDoArDeixaOSensorDownSemLancarExcecao() {
        when(telemetrias.ultimaLeitura()).thenThrow(new DataAccessResourceFailureException("sem conexão"));

        Health h = indicador.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails()).containsKey("error");
    }

    @Test
    void limiteConfiguravel() {
        var doisMinutos = new SensorWokwiHealthIndicator(telemetrias, Duration.ofMinutes(2), Clock.fixed(AGORA, ZoneOffset.UTC));
        ultimaLeituraHa(90);
        Health h = doisMinutos.health();
        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsEntry("limiteSemLeituraSegundos", 120L);
    }
}
