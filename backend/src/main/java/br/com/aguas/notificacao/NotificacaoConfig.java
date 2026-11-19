package br.com.aguas.notificacao;

import java.util.concurrent.ThreadPoolExecutor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.micrometer.tagged.TaggedCircuitBreakerMetrics;
import io.micrometer.core.instrument.binder.MeterBinder;

/**
 * Fila própria dos avisos: poucas threads e fila limitada, para um Telegram fora do ar não acumular
 * trabalho na API. Se a fila encher, o aviso é descartado; o alerta continua no sistema.
 * O agendamento liga a rotina de reenvio dos avisos pendentes (ReenvioDeAvisos).
 * Aqui também é montado o disjuntor que protege as chamadas à Bot API (DisjuntorProperties).
 */
@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({TelegramProperties.class, DisjuntorProperties.class})
public class NotificacaoConfig {

    public static final String EXECUTOR = "avisos";

    /** Nome do disjuntor no log e nas métricas (resilience4j.circuitbreaker.*, etiqueta "name"). */
    public static final String DISJUNTOR = "telegram";

    private static final Logger log = LoggerFactory.getLogger(NotificacaoConfig.class);

    @Bean(EXECUTOR)
    public ThreadPoolTaskExecutor avisos() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("aviso-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());
        return executor;
    }

    @Bean
    public CircuitBreakerRegistry registroDeDisjuntores(DisjuntorProperties props) {
        var registro = CircuitBreakerRegistry.of(configuracao(props));
        registro.circuitBreaker(DISJUNTOR);
        return registro;
    }

    @Bean
    public CircuitBreaker disjuntorDoTelegram(CircuitBreakerRegistry registro) {
        CircuitBreaker disjuntor = registro.circuitBreaker(DISJUNTOR);
        // Uma linha no log a cada mudança de estado: é por ela que se vê, no Render, que o Telegram caiu e voltou.
        disjuntor.getEventPublisher().onStateTransition(evento -> log.warn(
                "Disjuntor do Telegram: {} -> {} (falhas: {}%).",
                evento.getStateTransition().getFromState(), evento.getStateTransition().getToState(),
                Math.round(disjuntor.getMetrics().getFailureRate())));
        return disjuntor;
    }

    /** Expõe estado e contagens do disjuntor em /api/actuator/metrics. */
    @Bean
    public MeterBinder metricasDosDisjuntores(CircuitBreakerRegistry registro) {
        return TaggedCircuitBreakerMetrics.ofCircuitBreakerRegistry(registro);
    }

    /** Disjuntor avulso, sem Spring: usado pelo construtor de teste de Telegram. */
    static CircuitBreaker disjuntor(DisjuntorProperties props) {
        return CircuitBreakerRegistry.of(configuracao(props)).circuitBreaker(DISJUNTOR);
    }

    private static CircuitBreakerConfig configuracao(DisjuntorProperties props) {
        return CircuitBreakerConfig.custom()
                // Porcentagem de falhas nas últimas chamadas, não falhas seguidas: 6 de 10 abrem, 3 de 10 não.
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(props.janelaOuPadrao())
                .minimumNumberOfCalls(props.minimoChamadasOuPadrao())
                .failureRateThreshold(props.limiteFalhasOuPadrao())
                .waitDurationInOpenState(props.esperaAbertoOuPadrao())
                // Passada a espera, uma única chamada testa se o Telegram voltou.
                .permittedNumberOfCallsInHalfOpenState(1)
                // Sem thread extra: a passagem de "aberto" para "meio aberto" acontece na próxima chamada.
                .automaticTransitionFromOpenToHalfOpenEnabled(false)
                .ignoreException(Telegram::recusaDaNossaRequisicao)
                .build();
    }
}
