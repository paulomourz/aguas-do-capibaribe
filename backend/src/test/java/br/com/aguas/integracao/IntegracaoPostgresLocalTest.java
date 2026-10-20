package br.com.aguas.integracao;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Alternativa sem Docker: executa os testes de integração num PostgreSQL local e descartável,
 * já carregado com database/banco.sql (passo a passo no README).
 *
 * Trava de segurança: só roda se TESTE_PG_URL apontar para localhost E para um banco cujo nome
 * termina em "_teste". Nunca aponte para o banco real; estes testes inserem dados.
 */
@EnabledIfEnvironmentVariable(named = "TESTE_PG_URL",
        matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):\\d+/\\w+_teste(\\?.*)?")
class IntegracaoPostgresLocalTest extends IntegracaoPostgresBase {

    @DynamicPropertySource
    static void banco(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("TESTE_PG_URL"));
        r.add("spring.datasource.username", () -> System.getenv().getOrDefault("TESTE_PG_USER", "postgres"));
        r.add("spring.datasource.password", () -> System.getenv().getOrDefault("TESTE_PG_PASSWORD", ""));
    }
}
