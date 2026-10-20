package br.com.aguas.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Converte exceções em respostas {codigo, mensagem, campos}. Detalhes internos só vão para o log. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErroApiDTO> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(new ErroApiDTO(e.getCodigo(), e.getMessage(), e.getCampos()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErroApiDTO> validacao(MethodArgumentNotValidException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        for (FieldError f : e.getBindingResult().getFieldErrors()) campos.putIfAbsent(f.getField(), f.getDefaultMessage());
        return erro(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Verifique os campos destacados.", campos);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ErroApiDTO> validacaoParametros(HandlerMethodValidationException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        e.getParameterValidationResults().forEach(r -> campos.putIfAbsent(
                r.getMethodParameter().getParameterName(), r.getResolvableErrors().get(0).getDefaultMessage()));
        return erro(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Verifique os parâmetros informados.", campos);
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class })
    ResponseEntity<ErroApiDTO> requisicaoInvalida(Exception e) {
        return erro(HttpStatus.BAD_REQUEST, "REQUISICAO_INVALIDA", "A requisição tem dados em formato inválido.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErroApiDTO> rotaInexistente(NoResourceFoundException e) {
        return erro(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", "Recurso não encontrado.", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErroApiDTO> metodo(HttpRequestMethodNotSupportedException e) {
        return erro(HttpStatus.METHOD_NOT_ALLOWED, "METODO_NAO_PERMITIDO", "Método HTTP não suportado nesta rota.", null);
    }

    /** Ex.: corrida em login/nome único ou lote já vinculado a um alerta (PK de alerta_lote). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErroApiDTO> integridade(DataIntegrityViolationException e) {
        log.warn("Violação de integridade: {}", e.getMostSpecificCause().getMessage());
        return erro(HttpStatus.CONFLICT, "CONFLITO", "A operação conflita com dados já existentes. Atualize a página e tente novamente.", null);
    }

    @ExceptionHandler({ CannotCreateTransactionException.class, DataAccessResourceFailureException.class })
    ResponseEntity<ErroApiDTO> bancoIndisponivel(Exception e) {
        log.error("Banco de dados indisponível", e);
        return erro(HttpStatus.SERVICE_UNAVAILABLE, "BANCO_INDISPONIVEL", "Banco de dados indisponível no momento. Tente novamente.", null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErroApiDTO> inesperado(Exception e) {
        log.error("Erro inesperado", e);
        return erro(HttpStatus.INTERNAL_SERVER_ERROR, "ERRO_INTERNO", "Erro inesperado no servidor.", null);
    }

    private static ResponseEntity<ErroApiDTO> erro(HttpStatus s, String codigo, String msg, Map<String, String> campos) {
        return ResponseEntity.status(s).body(new ErroApiDTO(codigo, msg, campos));
    }
}
