package br.com.aguas.config;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.FiltroDeLimite;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({ AppProperties.class, AdminProperties.class, LimiteProperties.class })
public class SecurityConfig {

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, ConversorJwt conversor, RespostasDeSeguranca respostas,
            LimiteProperties limite) throws Exception {
        http
            // API sem cookies de sessão: o token vai no cabeçalho Authorization, então CSRF não se aplica.
            .csrf(c -> c.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                .requestMatchers("/error").permitAll()
                // Documentação (Swagger UI); desligável com SWAGGER_ATIVO=false
                .requestMatchers(HttpMethod.GET, "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/usuarios").hasRole("GESTOR")
                .requestMatchers(HttpMethod.POST, "/usuarios").hasRole("GESTOR")
                .requestMatchers(HttpMethod.PATCH, "/usuarios/*/ativo").hasRole("GESTOR")
                .requestMatchers(HttpMethod.PATCH, "/usuarios/*/senha").hasRole("GESTOR")
                .requestMatchers(HttpMethod.POST, "/processos").hasRole("GESTOR")
                .requestMatchers(HttpMethod.PUT, "/processos/*").hasRole("GESTOR")
                .requestMatchers("/alertas/**", "/relatorios/**").hasRole("GESTOR")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o
                .jwt(j -> j.jwtAuthenticationConverter(conversor))
                .authenticationEntryPoint(respostas))
            .exceptionHandling(e -> e.authenticationEntryPoint(respostas).accessDeniedHandler(respostas))
            // Depois do token, para limitar os lotes por usuário; depois do CORS, para o navegador ler o 429.
            .addFilterAfter(new FiltroDeLimite(limite, respostas), BearerTokenAuthenticationFilter.class);
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
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
        fonte.registerCorsConfiguration("/**", cfg);
        return fonte;
    }
}
