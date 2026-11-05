package br.com.aguas.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.transaction.TransactionAwareCacheManagerProxy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Cache em memória da API. Hoje guarda só a lista de processos têxteis ({@link #PROCESSOS}), lida em toda tela e
 * pelo sensor a cada envio, e que só muda quando o gestor cria ou edita um processo (nome, unidade ou meta).
 *
 * <p>Duas garantias para nunca servir meta velha:
 * <ul>
 *   <li>{@code order = HIGHEST_PRECEDENCE}: o cache fica por fora do {@code @Transactional}. A remoção da entrada
 *       ({@code @CacheEvict}) só acontece depois do commit, e uma leitura que acerta o cache nem abre transação.</li>
 *   <li>{@link TransactionAwareCacheManagerProxy}: se um dia o serviço for chamado de dentro de outra transação, a
 *       remoção espera o commit dela; se ela for desfeita, a entrada continua valendo.</li>
 * </ul>
 *
 * <p>O cache é local de cada instância. Com mais de uma instância da API, troque por um cache compartilhado (Redis).
 */
@Configuration
@EnableCaching(order = Ordered.HIGHEST_PRECEDENCE)
public class CacheConfig {

    /** Lista de processos ativos (GET /processos). Invalidada ao criar ou editar um processo. */
    public static final String PROCESSOS = "processos";

    @Bean
    public CacheManager cacheManager() {
        ConcurrentMapCacheManager caches = new ConcurrentMapCacheManager(PROCESSOS);
        caches.setAllowNullValues(false);
        return new TransactionAwareCacheManagerProxy(caches);
    }
}
