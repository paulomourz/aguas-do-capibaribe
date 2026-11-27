package br.com.aguas.security;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

/**
 * Requisição com o corpo já lido, que pode ser lido de novo pelo controller. Usada só no login, cujo
 * corpo é um JSON pequeno, para o filtro de limite saber qual conta está tentando entrar.
 */
class CorpoRelido extends HttpServletRequestWrapper {

    private final byte[] corpo;

    CorpoRelido(HttpServletRequest req) throws IOException {
        super(req);
        this.corpo = req.getInputStream().readAllBytes();
    }

    byte[] corpo() {
        return corpo;
    }

    @Override
    public ServletInputStream getInputStream() {
        ByteArrayInputStream dados = new ByteArrayInputStream(corpo);
        return new ServletInputStream() {
            @Override public int read() { return dados.read(); }
            @Override public int read(byte[] b, int off, int len) { return dados.read(b, off, len); }
            @Override public boolean isFinished() { return dados.available() == 0; }
            @Override public boolean isReady() { return true; }
            @Override public void setReadListener(ReadListener ouvinte) { throw new UnsupportedOperationException(); }
        };
    }

    @Override
    public BufferedReader getReader() {
        return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
    }
}
