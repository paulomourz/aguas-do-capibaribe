package br.com.aguas.security;

import java.util.List;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Component;

import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;

/**
 * Converte o JWT em usuário autenticado consultando o banco a cada requisição:
 * usuário desativado ou removido perde o acesso imediatamente, e o perfil vem sempre do banco.
 */
@Component
public class ConversorJwt implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UsuarioRepository usuarios;

    public ConversorJwt(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Integer id;
        try {
            id = Integer.valueOf(jwt.getSubject());
        } catch (NumberFormatException e) {
            throw new InvalidBearerTokenException("Token inválido.");
        }
        Usuario u = usuarios.findById(id)
                .filter(Usuario::isAtivo)
                .orElseThrow(() -> new InvalidBearerTokenException("Usuário inativo ou inexistente."));
        var principal = new UsuarioAutenticado(u.getId(), u.getPerfil());
        var papel = new SimpleGrantedAuthority("ROLE_" + u.getPerfil().name().toUpperCase());
        return new UsernamePasswordAuthenticationToken(principal, jwt, List.of(papel));
    }
}
