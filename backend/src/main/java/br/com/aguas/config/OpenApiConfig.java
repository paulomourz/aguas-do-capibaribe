package br.com.aguas.config;

import java.util.List;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;

/**
 * Documentação OpenAPI exibida no Swagger UI (/api/swagger-ui.html).
 * Todas as rotas exigem o token JWT, exceto o login; o botão "Authorize" recebe o token.
 */
@Configuration
public class OpenApiConfig {

    static final String JWT = "bearerAuth";
    static final String ERRO = "ErroApi";

    @Bean
    OpenAPI documentacao(@Value("${app.versao:dev}") String versao) {
        return new OpenAPI()
                .info(new Info()
                        .title("Águas do Capibaribe API")
                        .version(versao)
                        .description("API REST para Gestão de Consumo Hídrico em Lavanderias Industriais de Jeans "
                                + "(PI ADS Senac PE 2026.2).\n\n"
                                + "Para testar as rotas protegidas: chame **POST /auth/login**, copie o `token` da resposta, "
                                + "clique em **Authorize** e cole o token (sem a palavra Bearer)."))
                .components(new Components()
                        .addSecuritySchemes(JWT, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Token devolvido por POST /auth/login. Vale 8 horas."))
                        .addSchemas(ERRO, new Schema<>()
                                .type("object")
                                .description("Formato de todos os erros da API.")
                                .addProperty("codigo", new Schema<>().type("string").example("VALIDACAO"))
                                .addProperty("mensagem", new Schema<>().type("string").example("Verifique os campos destacados."))
                                .addProperty("campos", new Schema<>().type("object")
                                        .description("Só em erros de validação (422): campo → mensagem.")
                                        .additionalProperties(new Schema<>().type("string")))))
                .addSecurityItem(new SecurityRequirement().addList(JWT))
                // Ordem dos grupos na página
                .tags(List.of(
                        new Tag().name("Auth").description("Login e sessão"),
                        new Tag().name("Processos").description("Processos de lavagem e suas metas"),
                        new Tag().name("Lotes").description("Registro e consulta do consumo de cada lote"),
                        new Tag().name("Alertas").description("Sequências de lotes acima da meta (só gestor)"),
                        new Tag().name("Usuários").description("Acessos ao sistema"),
                        new Tag().name("Relatórios").description("Consolidado mensal (só gestor)"),
                        new Tag().name("Auditoria").description("Ações de um gestor sobre outras contas (só gestor)")));
    }

    /** Respostas de erro comuns a todas as rotas protegidas, no formato ErroApi. */
    @Bean
    OpenApiCustomizer errosComuns() {
        return api -> api.getPaths().values().forEach(caminho -> caminho.readOperations().forEach(op -> {
            boolean publica = op.getSecurity() != null && op.getSecurity().isEmpty();
            if (publica) return;
            op.getResponses().putIfAbsent("401", erro("Sem token, token inválido/expirado ou usuário desativado."));
        }));
    }

    static ApiResponse erro(String descricao) {
        return new ApiResponse().description(descricao).content(new Content().addMediaType("application/json",
                new MediaType().schema(new Schema<>().$ref("#/components/schemas/" + ERRO))));
    }
}
