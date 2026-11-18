package br.com.aguas.controller;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.aguas.config.SecurityConfig;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;

/**
 * Issue #156 (RNF04): Given um JSON em POST /api/telemetria, When vazaoLitros é nulo ou negativo,
 * Then a API responde 400 com o erro estruturado no campo vazaoLitros.
 */
@WebMvcTest(controllers = TelemetriaController.class)
@Import({ SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class, EventosDeSeguranca.class })
@TestPropertySource(properties = {
        "app.limite.login-por-minuto=100000",
        "app.limite.lotes-por-minuto=100000",
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443" })
class TelemetriaControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;

    private String token;

    @BeforeEach
    void sensorLogado() {
        Usuario u = new Usuario("Sensor", "sensor", "x".repeat(60), Perfil.sensor);
        ReflectionTestUtils.setField(u, "id", 1);
        when(usuarios.findById(1)).thenReturn(Optional.of(u));
        token = "Bearer " + jwt.gerar(1);
    }

    private ResultActions enviar(String corpo) throws Exception {
        return mvc.perform(post("/telemetria")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo));
    }

    @Test
    void leituraValidaRetorna202() throws Exception {
        enviar("{\"processoId\":1,\"vazaoLitros\":12.50}")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.vazaoLitros").value(12.50));
    }

    @Test
    void vazaoZeroEhAceita() throws Exception {
        enviar("{\"processoId\":1,\"vazaoLitros\":0}").andExpect(status().isAccepted());
    }

    @Test
    void vazaoNulaRetorna400NoCampoVazaoLitros() throws Exception {
        enviar("{\"processoId\":1,\"vazaoLitros\":null}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("TELEMETRIA_INVALIDA"))
                .andExpect(jsonPath("$.campos.vazaoLitros").value("Informe a vazão em litros."));
    }

    @Test
    void vazaoAusenteRetorna400() throws Exception {
        enviar("{\"processoId\":1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.vazaoLitros").exists());
    }

    @Test
    void vazaoNegativaRetorna400NoCampoVazaoLitros() throws Exception {
        enviar("{\"processoId\":1,\"vazaoLitros\":-3.5}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.vazaoLitros").value("A vazão em litros não pode ser negativa."));
    }

    @Test
    void vazaoAcimaDoMaximoRetorna400() throws Exception {
        enviar("{\"processoId\":1,\"vazaoLitros\":20000}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.vazaoLitros").exists());
    }

    @Test
    void processoInvalidoRetorna400NoCampoProcessoId() throws Exception {
        enviar("{\"processoId\":0,\"vazaoLitros\":5}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.processoId").exists());
    }
}
