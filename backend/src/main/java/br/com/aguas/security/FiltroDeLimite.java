package br.com.aguas.security;

import java.io.IOException;
import java.util.Locale;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import br.com.aguas.config.LimiteProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Responde 429 quando o login (por IP e por conta) ou o registro de lotes (por usuário) passam do limite por minuto,
 * antes de consultar o banco no caso do login. Criado em SecurityConfig, para rodar só na cadeia de segurança.
 */
public class FiltroDeLimite extends OncePerRequestFilter {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Limitador login;
    /** null quando app.limite.login-por-conta-por-minuto é 0. */
    private final Limitador loginPorConta;
    private final Limitador lotes;
    private final String cabecalhoIp;
    private final RespostasDeSeguranca respostas;
    private final EventosDeSeguranca eventos;

    public FiltroDeLimite(LimiteProperties props, RespostasDeSeguranca respostas, EventosDeSeguranca eventos) {
        this.login = new Limitador(props.loginPorMinuto());
        this.loginPorConta = props.loginPorContaPorMinuto() > 0 ? new Limitador(props.loginPorContaPorMinuto()) : null;
        this.lotes = new Limitador(props.lotesPorMinuto());
        this.cabecalhoIp = props.cabecalhoIp();
        this.respostas = respostas;
        this.eventos = eventos;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain cadeia)
            throws ServletException, IOException {
        long espera = 0;
        String rota = null;
        if (HttpMethod.POST.matches(req.getMethod())) {
            String caminho = req.getRequestURI().substring(req.getContextPath().length());
            if (caminho.equals("/auth/login")) {
                rota = EventosDeSeguranca.ROTA_LOGIN;
                espera = login.consumir(ipDoCliente(req));
                if (espera == 0 && loginPorConta != null) {
                    CorpoRelido relido = new CorpoRelido(req);
                    req = relido;
                    String conta = contaDoLogin(relido.corpo());
                    if (conta != null) espera = loginPorConta.consumir(conta);
                }
            } else if (caminho.equals("/lotes")
                    && SecurityContextHolder.getContext().getAuthentication() != null
                    && SecurityContextHolder.getContext().getAuthentication().getPrincipal() instanceof UsuarioAutenticado quem) {
                rota = EventosDeSeguranca.ROTA_LOTES;
                espera = lotes.consumir(String.valueOf(quem.id()));
            }
        }
        if (espera > 0) {
            // Para o painel de segurança do administrador (issue #109), com o IP mascarado.
            eventos.bloqueio(rota, ipDoCliente(req));
            respostas.limiteExcedido(resp, espera);
            return;
        }
        cadeia.doFilter(req, resp);
    }

    /** O "usuario" do JSON do login, como o AuthService compara (sem espaços e sem diferença de maiúsculas). */
    private static String contaDoLogin(byte[] corpo) {
        try {
            String usuario = JSON.readTree(corpo).path("usuario").asText("").trim().toLowerCase(Locale.ROOT);
            return usuario.isEmpty() ? null : usuario;
        } catch (IOException e) {
            return null; // JSON inválido: o controller responde o erro de validação
        }
    }

    private String ipDoCliente(HttpServletRequest req) {
        String ip = cabecalhoIp == null || cabecalhoIp.isBlank() ? null : req.getHeader(cabecalhoIp);
        return ip == null || ip.isBlank() ? req.getRemoteAddr() : ip.trim();
    }
}
