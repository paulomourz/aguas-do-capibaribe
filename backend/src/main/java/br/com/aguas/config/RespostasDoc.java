package br.com.aguas.config;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/** Respostas de erro reutilizadas na documentação dos controllers (formato ErroApi). */
public final class RespostasDoc {

    private RespostasDoc() {}

    /**
     * 200 com o formato do retorno do método. Ao declarar erros, o springdoc deixa de gerar o 200 sozinho,
     * então toda rota com @Validacao, @SoGestor etc. que responde 200 também leva esta anotação.
     */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "200", description = "OK.")
    public @interface Ok {}

    /** 422: algum campo ou parâmetro não passou na validação. */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "422", description = "Dados inválidos; `campos` diz o problema de cada um.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface Validacao {}

    /** 429: passou do limite de requisições por minuto. */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "429", description = "Muitas requisições; o cabeçalho `Retry-After` diz quantos segundos esperar.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface LimiteExcedido {}

    /** 403: rota exclusiva de administrador e gestor. */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "403", description = "Só administrador ou gestor podem usar esta rota.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface SoGestor {}

    /** 403: rota exclusiva do administrador. */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "403", description = "Só o administrador pode usar esta rota.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface SoAdmin {}

    /** 409: a operação fere uma regra de negócio (ex.: desativar a própria conta). */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "409", description = "Operação não permitida pela regra de negócio; `mensagem` explica o motivo.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface Conflito {}

    /** 404: o id informado não existe (ou o operador não pode vê-lo). */
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @ApiResponse(responseCode = "404", description = "Registro não encontrado.",
            content = @Content(mediaType = "application/json", schema = @Schema(ref = OpenApiConfig.ERRO)))
    public @interface NaoEncontrado {}
}
