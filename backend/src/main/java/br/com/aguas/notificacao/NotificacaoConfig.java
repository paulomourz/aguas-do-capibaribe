package br.com.aguas.notificacao;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Fila própria dos avisos: poucas threads e fila limitada, para um Telegram fora do ar não acumular
 * trabalho na API. Se a fila encher, o aviso é descartado; o alerta continua no sistema.
 */
@Configuration
@EnableAsync
@EnableConfigurationProperties(TelegramProperties.class)
public class NotificacaoConfig {

    public static final String EXECUTOR = "avisos";

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
}
