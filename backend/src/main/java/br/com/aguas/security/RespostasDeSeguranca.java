package br.com.aguas.security;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.aguas.exception.ErroApiDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Respostas 401/403/429 no mesmo formato de erro usado pelo front ({codigo, mensagem}). */
@Component
public class RespostasDeSeguranca implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper json;

    public RespostasDeSeguranca(ObjectMapper json) {
        this.json = json;
    }

    @Override
    public void commence(HttpServletRequest req, HttpServletResponse resp, AuthenticationException e) throws IOException {
        escrever(resp, HttpStatus.UNAUTHORIZED, new ErroApiDTO("NAO_AUTENTICADO", "Sessão expirada ou inválida. Faça login novamente."));
    }

    @Override
    public void handle(HttpServletRequest req, HttpServletResponse resp, AccessDeniedException e) throws IOException {
        escrever(resp, HttpStatus.FORBIDDEN, new ErroApiDTO("ACESSO_NEGADO", "Seu perfil não tem acesso a esta função."));
    }

    /** 429: passou do limite de requisições; o cabeçalho Retry-After diz quantos segundos esperar. */
    void limiteExcedido(HttpServletResponse resp, long segundos) throws IOException {
        resp.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(segundos));
        escrever(resp, HttpStatus.TOO_MANY_REQUESTS,
                new ErroApiDTO("LIMITE_EXCEDIDO", "Muitas tentativas. Aguarde " + segundos + " segundos e tente de novo."));
    }

    private void escrever(HttpServletResponse resp, HttpStatus status, ErroApiDTO erro) throws IOException {
        resp.setStatus(status.value());
        resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
        resp.setCharacterEncoding("UTF-8");
        json.writeValue(resp.getOutputStream(), erro);
    }
}
