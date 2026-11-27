package br.com.aguas.config;

import java.time.Duration;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Propriedades "app.*" do application.yml (preenchidas por variáveis de ambiente). */
@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, String corsOrigens, String fusoRelatorios) {

    public record Jwt(String segredo, Duration expiracao) {}

    /** Lista de origens CORS; "*" é recusado para não liberar todas as origens. */
    public List<String> origensCors() {
        if (corsOrigens == null || corsOrigens.isBlank()) return List.of();
        List<String> origens = Arrays.stream(corsOrigens.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Urls::semBarraNoFim)
                .toList();
        if (origens.stream().anyMatch(s -> s.contains("*"))) {
            throw new IllegalStateException("CORS_ORIGINS não aceita '*'. Liste as origens autorizadas explicitamente.");
        }
        return origens;
    }

    public ZoneId zonaRelatorios() {
        return ZoneId.of(fusoRelatorios == null || fusoRelatorios.isBlank() ? "America/Recife" : fusoRelatorios);
    }
}
