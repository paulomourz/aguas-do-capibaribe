package br.com.aguas.integracao;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Alternativa sem Docker: executa os testes de integração num PostgreSQL local e descartável. O banco
 * pode começar vazio: o Flyway cria o esquema na subida (passo a passo no README).
 *
 * Trava de segurança: só roda se TESTE_PG_URL apontar para localhost E para um banco cujo nome
 * termina em "_teste". Nunca aponte para o banco real; estes testes inserem dados.
 */
@EnabledIfEnvironmentVariable(named = "TESTE_PG_URL",
        matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):\\d+/\\w+_teste(\\?.*)?")
class IntegracaoPostgresLocalTest extends CicloCompletoLavanderiaE2ETest {

    @DynamicPropertySource
    static void banco(DynamicPropertyRegistry r) {
        String usuario = System.getenv().getOrDefault("TESTE_PG_USER", "postgres");
        String senha = System.getenv().getOrDefault("TESTE_PG_PASSWORD", "");
        r.add("spring.datasource.url", () -> System.getenv("TESTE_PG_URL"));
        r.add("spring.datasource.username", () -> usuario);
        r.add("spring.datasource.password", () -> senha);
        // Com TESTE_PG_USER=aguas_api (sem permissão de criar tabelas), informe o dono do esquema.
        r.add("spring.flyway.user", () -> System.getenv().getOrDefault("TESTE_FLYWAY_USER", usuario));
        r.add("spring.flyway.password", () -> System.getenv().getOrDefault("TESTE_FLYWAY_PASSWORD", senha));
    }
}
