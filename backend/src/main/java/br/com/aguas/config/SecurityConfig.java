package br.com.aguas.config;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.HeaderWriterFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import br.com.aguas.security.ConversorJwt;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.FiltroDeLimite;
import br.com.aguas.security.FiltroTokenDeApi;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({ AppProperties.class, AdminProperties.class, LimiteProperties.class })
public class SecurityConfig {

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, ConversorJwt conversor, RespostasDeSeguranca respostas,
            LimiteProperties limite, UsuarioRepository usuarios, EventosDeSeguranca eventos) throws Exception {
        // O token de API (64 caracteres alfanuméricos) é tratado pelo FiltroTokenDeApi; o que sobra é JWT.
        DefaultBearerTokenResolver cabecalho = new DefaultBearerTokenResolver();
        BearerTokenResolver soJwt = req -> FiltroTokenDeApi.chaveDe(req) != null ? null : cabecalho.resolve(req);
        http
            // API sem cookies de sessão: o token vai no cabeçalho Authorization, então CSRF não se aplica.
            .csrf(c -> c.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Cabeçalhos de segurança escritos no início da requisição, e não quando a resposta é confirmada:
            // no CSV em streaming (GET /relatorios/csv), a confirmação acontece em outra thread, ao mesmo tempo
            // que a requisição termina, e os dois mexeriam nos cabeçalhos juntos (ConcurrentModificationException).
            .headers(h -> h.addObjectPostProcessor(new ObjectPostProcessor<HeaderWriterFilter>() {
                @Override
                public <O extends HeaderWriterFilter> O postProcess(O filtro) {
                    filtro.setShouldWriteHeadersEagerly(true);
                    return filtro;
                }
            }))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                .requestMatchers("/error").permitAll()
                // Documentação (Swagger UI); desligável com SWAGGER_ATIVO=false
                .requestMatchers(HttpMethod.GET, "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                // Monitoramento (issue #51): a saúde é aberta e, sem token, só diz UP ou DOWN;
                // as métricas mostram o uso da API e ficam só com o admin.
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/actuator/metrics", "/actuator/metrics/*").hasRole("ADMIN")
                .requestMatchers("/actuator/**").denyAll()
                // O gestor só lê a lista: o histórico mostra quem registrou cada lote.
                .requestMatchers(HttpMethod.GET, "/usuarios").hasAnyRole("ADMIN", "GESTOR")
                .requestMatchers(HttpMethod.POST, "/usuarios").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/usuarios/*/ativo").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/usuarios/*/senha").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/usuarios/*/token/rotacao").hasRole("ADMIN")
                .requestMatchers("/auditoria/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/processos").hasAnyRole("ADMIN", "GESTOR")
                .requestMatchers(HttpMethod.PUT, "/processos/*").hasAnyRole("ADMIN", "GESTOR")
                .requestMatchers("/alertas/**", "/relatorios/**", "/precos-m3/**").hasAnyRole("ADMIN", "GESTOR")
                // O sensor só faz o que o envio precisa: consultar os processos e registrar lotes.
                .requestMatchers(HttpMethod.GET, "/processos").hasAnyRole("ADMIN", "GESTOR", "OPERADOR", "SENSOR")
                .requestMatchers(HttpMethod.POST, "/lotes").hasAnyRole("ADMIN", "GESTOR", "OPERADOR", "SENSOR")
                .anyRequest().hasAnyRole("ADMIN", "GESTOR", "OPERADOR"))
            .oauth2ResourceServer(o -> o
                .bearerTokenResolver(soJwt)
                .jwt(j -> j.jwtAuthenticationConverter(conversor))
                .authenticationEntryPoint(respostas))
            .exceptionHandling(e -> e.authenticationEntryPoint(respostas).accessDeniedHandler(respostas))
            .addFilterBefore(new FiltroTokenDeApi(usuarios), BearerTokenAuthenticationFilter.class)
            // Depois do token, para limitar os lotes por usuário; depois do CORS, para o navegador ler o 429.
            .addFilterAfter(new FiltroDeLimite(limite, respostas, eventos), BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(JwtService jwt) {
        return jwt.decoder();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.origensCors());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Idempotency-Key"));
        // Sem isto, o navegador esconde o Retry-After do 429 do site em outra origem (o fetch lê null).
        cfg.setExposedHeaders(List.of("Retry-After"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
        fonte.registerCorsConfiguration("/**", cfg);
        return fonte;
    }
}
