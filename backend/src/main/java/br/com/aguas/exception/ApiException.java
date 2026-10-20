package br.com.aguas.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;

/** Erro de regra de negócio com status HTTP e código estável para o front. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String codigo;
    private final Map<String, String> campos;

    public ApiException(HttpStatus status, String codigo, String mensagem, Map<String, String> campos) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
        this.campos = campos == null ? Map.of() : Map.copyOf(campos);
    }

    public static ApiException naoEncontrado(String mensagem) {
        return new ApiException(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", mensagem, null);
    }

    public static ApiException validacao(String campo, String mensagem) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", mensagem, Map.of(campo, mensagem));
    }

    public static ApiException conflito(String codigo, String mensagem, String campo) {
        return new ApiException(HttpStatus.CONFLICT, codigo, mensagem, campo == null ? null : Map.of(campo, mensagem));
    }

    public static ApiException proibido(String mensagem) {
        return new ApiException(HttpStatus.FORBIDDEN, "ACESSO_NEGADO", mensagem, null);
    }

    public HttpStatus getStatus() { return status; }
    public String getCodigo() { return codigo; }
    public Map<String, String> getCampos() { return campos; }
}
