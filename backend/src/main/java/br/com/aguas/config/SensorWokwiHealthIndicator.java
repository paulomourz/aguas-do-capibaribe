package br.com.aguas.config;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;

import br.com.aguas.entity.Lote;
import br.com.aguas.entity.Perfil;
import br.com.aguas.repository.LoteRepository;

/**
 * Saúde do sensor do Wokwi no Actuator (issue #158). Diz se o sensor continua enviando leituras, para o operador
 * descobrir que o dispositivo parou sem precisar abrir o Histórico.
 *
 * <p>O nome do bean define o nome do componente: o Spring Boot tira o sufixo "HealthIndicator", então esta classe
 * aparece como <b>sensorWokwi</b> em {@code GET /api/actuator/health}. Os detalhes só aparecem para o administrador
 * ({@code management.endpoint.health.show-details: when-authorized}); sem token, a resposta continua sendo só o
 * status, como manda o RNF20.
 *
 * <p>O que conta como "leitura": o projeto não tem telemetria contínua. O sensor mede o lote no dispositivo e faz
 * um {@code POST /lotes} quando o lote é encerrado, então a última leitura é o último lote registrado por uma conta
 * de perfil {@code sensor}. O perfil é usado em vez do login {@code sensor.wokwi} porque é ele que a
 * {@code SecurityConfig} autoriza a registrar lotes, e ele continua valendo se a conta for renomeada ou se a equipe
 * criar uma segunda conta de sensor.
 *
 * <p>Estados possíveis:
 * <ul>
 *   <li><b>UP</b>: a última leitura está dentro da janela ({@code app.sensor.janela-telemetria});</li>
 *   <li><b>DOWN</b>: a última leitura passou da janela, com o tempo decorrido nos detalhes;</li>
 *   <li><b>UNKNOWN</b>: nenhuma conta de sensor registrou lote ainda (banco novo). Não é falha do sensor, e UNKNOWN
 *       não derruba o total de {@code /actuator/health}, que o Render usa como checagem de saúde.</li>
 * </ul>
 *
 * <p>No limite exato da janela o componente fica UP: a issue pede DOWN quando o tempo <i>excede</i> a janela, e é a
 * mesma convenção do desvio de 8% do lote, que com 8% exatos fica em atenção, e não em crítico.
 *
 * <p><b>Atenção (risco operacional).</b> Todo HealthIndicator entra na soma de {@code /actuator/health}: com este
 * componente em DOWN, o endpoint responde 503, e quem usa esse endpoint como checagem de saúde (o Render e o
 * healthcheck do contêiner, em {@code backend/docker/Saude.java}) entende que a API caiu. Com a janela de 60
 * segundos do enunciado, qualquer período sem lote — à noite, no fim de semana, ou com a simulação do Wokwi
 * desligada — deixa a API publicada como DOWN. Em produção, aumente a janela
 * ({@code SENSOR_JANELA_TELEMETRIA=6h}) ou desligue o componente ({@code SENSOR_SAUDE_ATIVO=false}) enquanto a
 * equipe decide separar a checagem da plataforma num grupo de saúde próprio.
 */
@Component
@ConditionalOnProperty(name = "app.sensor.saude.ativo", matchIfMissing = true)
public class SensorWokwiHealthIndicator implements HealthIndicator {

    private final LoteRepository lotes;
    private final Duration janela;
    private final Clock relogio;

    @Autowired
    public SensorWokwiHealthIndicator(LoteRepository lotes,
            @Value("${app.sensor.janela-telemetria:60s}") Duration janela) {
        this(lotes, janela, Clock.systemUTC());
    }

    /** Usado pelos testes, com um relógio fixo, para o tempo decorrido não depender da hora em que o teste roda. */
    SensorWokwiHealthIndicator(LoteRepository lotes, Duration janela, Clock relogio) {
        this.lotes = lotes;
        this.janela = janela;
        this.relogio = relogio;
    }

    @Override
    public Health health() {
        Optional<Lote> ultimo = lotes.ultimosLotesDoPerfil(Perfil.sensor, Limit.of(1)).stream().findFirst();
        if (ultimo.isEmpty()) {
            return Health.unknown()
                    .withDetail("motivo", "nenhuma conta de perfil sensor registrou lote ainda")
                    .withDetail("janelaSegundos", janela.toSeconds())
                    .build();
        }

        Lote lote = ultimo.get();
        Duration semEnviar = Duration.between(lote.getRegistradoEm(), OffsetDateTime.now(relogio));
        // A hora do lote vem do banco e a hora atual vem da API: se os dois relógios estiverem alguns
        // milissegundos fora de sincronia, o tempo decorrido pode sair negativo e confundir quem lê os detalhes.
        if (semEnviar.isNegative()) semEnviar = Duration.ZERO;

        Health.Builder saude = semEnviar.compareTo(janela) > 0 ? Health.down() : Health.up();
        return saude
                .withDetail("ultimaLeitura", lote.getRegistradoEm().toString())
                .withDetail("segundosSemEnviar", semEnviar.toSeconds())
                .withDetail("janelaSegundos", janela.toSeconds())
                .withDetail("processoId", lote.getProcessoId())
                .withDetail("loteId", lote.getId())
                .build();
    }
}
