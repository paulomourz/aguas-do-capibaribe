package br.com.aguas.security;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import br.com.aguas.entity.Perfil;
import br.com.aguas.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Autentica o sensor pelo token de API ({@code Authorization: Bearer <chave de 64 caracteres>}).
 * A conta é procurada no banco pelo hash a cada requisição: depois da rotação, a chave anterior não
 * acha mais ninguém e a requisição segue sem autenticação (401). Conta desativada também perde o acesso.
 * Criado em SecurityConfig, para rodar só na cadeia de segurança.
 */
public class FiltroTokenDeApi extends OncePerRequestFilter {

    private static final String PREFIXO = "bearer ";

    private final UsuarioRepository usuarios;

    public FiltroTokenDeApi(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    /** A chave do cabeçalho, se ele trouxer um token de API; null para JWT, outro esquema ou sem cabeçalho. */
    public static String chaveDe(HttpServletRequest req) {
        String cabecalho = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (cabecalho == null || !cabecalho.regionMatches(true, 0, PREFIXO, 0, PREFIXO.length())) return null;
        String valor = cabecalho.substring(PREFIXO.length()).trim();
        return TokenDeApi.temFormato(valor) ? valor : null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain cadeia)
            throws ServletException, IOException {
        String chave = chaveDe(req);
        if (chave != null) {
            usuarios.findByTokenHash(TokenDeApi.hash(chave))
                    // Só a conta de sensor usa token de API; o perfil e o "ativo" vêm sempre do banco.
                    .filter(u -> u.isAtivo() && u.getPerfil() == Perfil.sensor)
                    .ifPresent(u -> {
                        var principal = new UsuarioAutenticado(u.getId(), u.getPerfil());
                        var papel = new SimpleGrantedAuthority("ROLE_" + u.getPerfil().name().toUpperCase());
                        SecurityContext contexto = SecurityContextHolder.createEmptyContext();
                        contexto.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of(papel)));
                        SecurityContextHolder.setContext(contexto);
                    });
        }
        cadeia.doFilter(req, resp);
    }
}
