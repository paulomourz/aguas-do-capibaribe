package br.com.aguas.integracao;

import java.nio.file.Path;

import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

/**
 * Executa os testes de integração num PostgreSQL 18 descartável (Docker), iniciado com database/banco.sql.
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
            .withPassword("somente-teste-local")
            .withCopyFileToContainer(
                    MountableFile.forHostPath(Path.of("..", "database", "banco.sql").toAbsolutePath()),
                    "/docker-entrypoint-initdb.d/01-banco.sql");
}
