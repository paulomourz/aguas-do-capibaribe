package br.com.aguas.exception;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Formato de erro esperado pelo front (src/services/tipos.ts: ErroApiDTO). */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ErroApiDTO(String codigo, String mensagem, Map<String, String> campos) {

    public ErroApiDTO(String codigo, String mensagem) {
        this(codigo, mensagem, null);
    }
}
