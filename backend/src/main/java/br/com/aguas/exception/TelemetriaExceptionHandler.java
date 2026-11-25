package br.com.aguas.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import br.com.aguas.controller.TelemetriaController;

/**
 * Validação da telemetria responde 400 (issue #156). Vale só para o TelemetriaController;
 * as outras rotas continuam com o 422 do GlobalExceptionHandler, que o front já espera.
 * HIGHEST_PRECEDENCE faz este handler ser consultado antes do global.
 */
@RestControllerAdvice(assignableTypes = TelemetriaController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TelemetriaExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErroApiDTO> validacao(MethodArgumentNotValidException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        for (FieldError f : e.getBindingResult().getFieldErrors()) campos.putIfAbsent(f.getField(), f.getDefaultMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErroApiDTO("TELEMETRIA_INVALIDA", "Leitura de telemetria recusada. Verifique os campos informados.", campos));
    }
}
