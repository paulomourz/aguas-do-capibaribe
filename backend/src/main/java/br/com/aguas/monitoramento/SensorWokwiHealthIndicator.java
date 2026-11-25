package br.com.aguas.monitoramento;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.stereotype.Component;

import br.com.aguas.dto.UltimaLeituraDTO;
import br.com.aguas.repository.TelemetriaRepository;

/**
 * Saúde do sensor ESP32 (Wokwi) no Actuator (issue #158, RNF03). Componente "sensorWokwi" (nome do bean sem o
 * sufixo HealthIndicator), no grupo /actuator/health/sensor.
 *
 * <p>UP se a última leitura de telemetria chegou há menos de {@code app.sensor.limite-sem-leitura} (60 s); DOWN se
 * passou disso ou se o sensor nunca enviou nada. Os detalhes trazem a hora da última leitura, os segundos desde ela
 * e cada linha de lavagem ativa (processo com leitura nas últimas 24 h) com a sua última leitura.
 *
 * <p>Fica fora do /actuator/health raiz (SaudeDoSensorForaDaRaiz): o Render e o healthcheck do Docker usam a raiz
 * para saber se a API está no ar, e um sensor parado não pode fazer a API ser reiniciada.
 *
 * <p>Erro ao consultar o banco: o AbstractHealthIndicator responde DOWN com o tipo do erro, sem derrubar o endpoint.
 */
@Component
public class SensorWokwiHealthIndicator extends AbstractHealthIndicator {

    /** Uma linha de lavagem conta como ativa se mandou alguma leitura neste período. */
    static final Duration JANELA_LINHAS_ATIVAS = Duration.ofHours(24);

    private final TelemetriaRepository telemetrias;
    private final Duration limite;
    private final Clock relogio;

    @Autowired
    public SensorWokwiHealthIndicator(TelemetriaRepository telemetrias,
                                      @Value("${app.sensor.limite-sem-leitura:60s}") Duration limite) {
        this(telemetrias, limite, Clock.systemUTC());
    }

    SensorWokwiHealthIndicator(TelemetriaRepository telemetrias, Duration limite, Clock relogio) {
        super("Falha ao consultar a última leitura do sensor.");
        this.telemetrias = telemetrias;
        this.limite = limite;
        this.relogio = relogio;
    }

    @Override
    protected void doHealthCheck(Health.Builder saude) {
        Instant agora = relogio.instant();
        saude.withDetail("limiteSemLeituraSegundos", limite.toSeconds());

        OffsetDateTime ultima = telemetrias.ultimaLeitura();
        if (ultima == null) {
            saude.down().withDetail("motivo", "Nenhuma leitura de telemetria registrada.");
            return;
        }

        long segundos = segundosDesde(ultima, agora);
        boolean emDia = recente(ultima, agora);
        saude.status(emDia ? Status.UP : Status.DOWN)
                .withDetail("ultimaLeitura", ultima.toInstant().toString())
                .withDetail("segundosDesdeUltimaLeitura", segundos);
        if (!emDia) {
            saude.withDetail("motivo", "Sem leitura há " + segundos + " s (limite de " + limite.toSeconds() + " s).");
        }

        OffsetDateTime desde = OffsetDateTime.ofInstant(agora.minus(JANELA_LINHAS_ATIVAS), ZoneOffset.UTC);
        List<Map<String, Object>> linhas = telemetrias.ultimaLeituraPorLinhaAtiva(desde).stream()
                .map(l -> linha(l, agora))
                .toList();
        saude.withDetail("linhasAtivas", linhas);
    }

    private Map<String, Object> linha(UltimaLeituraDTO l, Instant agora) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("processoId", l.processoId());
        m.put("processo", l.processo());
        m.put("status", (recente(l.registradoEm(), agora) ? Status.UP : Status.DOWN).getCode());
        m.put("ultimaLeitura", l.registradoEm().toInstant().toString());
        m.put("segundosDesdeUltimaLeitura", segundosDesde(l.registradoEm(), agora));
        return m;
    }

    /** "Menos de 60 s" (estrito): exatamente no limite já é DOWN. */
    private boolean recente(OffsetDateTime leitura, Instant agora) {
        return Duration.between(leitura.toInstant(), agora).compareTo(limite) < 0;
    }

    /** Relógio do servidor atrás do banco (leitura "no futuro") conta como 0 s, não como negativo. */
    private static long segundosDesde(OffsetDateTime leitura, Instant agora) {
        return Math.max(0, Duration.between(leitura.toInstant(), agora).toSeconds());
    }
}
