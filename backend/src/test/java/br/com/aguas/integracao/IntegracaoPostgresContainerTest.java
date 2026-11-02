package br.com.aguas.integracao;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Executa os testes de integração num PostgreSQL 18 descartável (Docker), que começa vazio: o esquema
 * é criado pelas migrações do Flyway na subida da API, como num banco novo de verdade.
 * Sem Docker disponível, a classe é ignorada (aparece como "skipped").
 */
@Testcontainers(disabledWithoutDocker = true)
class IntegracaoPostgresContainerTest extends IntegracaoPostgresBase {

    @Container
    @ServiceConnection
    @SuppressWarnings("resource") // o @Container para e fecha o container ao fim dos testes
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:18-alpine")
            .withDatabaseName("aguas_teste")
            .withUsername("postgres")
            .withPassword("somente-teste-local");

    @DynamicPropertySource
    static void flyway(DynamicPropertyRegistry r) {
        r.add("spring.flyway.user", pg::getUsername);
        r.add("spring.flyway.password", pg::getPassword);
    }
}
