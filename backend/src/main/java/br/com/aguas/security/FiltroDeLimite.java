package br.com.aguas.security;

import java.io.IOException;

import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import br.com.aguas.config.LimiteProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Responde 429 quando o login (por IP) ou o registro de lotes (por usuário) passam do limite por minuto,
 * antes de consultar o banco no caso do login. Criado em SecurityConfig, para rodar só na cadeia de segurança.
 */
public class FiltroDeLimite extends OncePerRequestFilter {

    private final Limitador login;
    private final Limitador lotes;
    private final String cabecalhoIp;
    private final RespostasDeSeguranca respostas;

    public FiltroDeLimite(LimiteProperties props, RespostasDeSeguranca respostas) {
        this.login = new Limitador(props.loginPorMinuto());
        this.lotes = new Limitador(props.lotesPorMinuto());
        this.cabecalhoIp = props.cabecalhoIp();
        this.respostas = respostas;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain cadeia)
            throws ServletException, IOException {
        long espera = 0;
        if (HttpMethod.POST.matches(req.getMethod())) {
            String caminho = req.getRequestURI().substring(req.getContextPath().length());
            if (caminho.equals("/auth/login")) {
                espera = login.consumir(ipDoCliente(req));
            } else if (caminho.equals("/lotes")
                    && SecurityContextHolder.getContext().getAuthentication() != null
                    && SecurityContextHolder.getContext().getAuthentication().getPrincipal() instanceof UsuarioAutenticado quem) {
                espera = lotes.consumir(String.valueOf(quem.id()));
            }
        }
        if (espera > 0) {
            respostas.limiteExcedido(resp, espera);
            return;
        }
        cadeia.doFilter(req, resp);
    }

    private String ipDoCliente(HttpServletRequest req) {
        String ip = cabecalhoIp == null || cabecalhoIp.isBlank() ? null : req.getHeader(cabecalhoIp);
        return ip == null || ip.isBlank() ? req.getRemoteAddr() : ip.trim();
    }
}
