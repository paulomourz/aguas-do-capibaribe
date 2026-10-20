package br.com.aguas.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import br.com.aguas.config.AppProperties;

/** Emite e valida tokens JWT HS256. Sem renovação: ao expirar, o usuário entra de novo. */
@Service
public class JwtService {

    private static final String EMISSOR = "aguas-api";
    private final NimbusJwtEncoder encoder;
    private final NimbusJwtDecoder decoder;
    private final Duration expiracao;

    public JwtService(AppProperties props) {
        String segredo = props.jwt() == null ? null : props.jwt().segredo();
        if (segredo == null || segredo.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET ausente ou curto: use pelo menos 32 caracteres aleatórios.");
        }
        SecretKey chave = new SecretKeySpec(segredo.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(chave));
        this.decoder = NimbusJwtDecoder.withSecretKey(chave).macAlgorithm(MacAlgorithm.HS256).build();
        this.expiracao = props.jwt().expiracao() == null ? Duration.ofHours(8) : props.jwt().expiracao();
    }

    public String gerar(Integer usuarioId) {
        Instant agora = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(EMISSOR)
                .subject(String.valueOf(usuarioId))
                .issuedAt(agora)
                .expiresAt(agora.plus(expiracao))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public JwtDecoder decoder() {
        return decoder;
    }
}
