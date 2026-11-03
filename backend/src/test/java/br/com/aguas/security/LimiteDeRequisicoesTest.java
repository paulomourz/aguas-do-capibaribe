package br.com.aguas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import br.com.aguas.config.SecurityConfig;
import br.com.aguas.controller.AuthController;
import br.com.aguas.controller.LoteController;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.service.AuthService;
import br.com.aguas.service.LoteService;
import br.com.aguas.service.UsuarioService;

/** Limite de login por IP e de lotes por usuário, passando pela cadeia de segurança real. */
@WebMvcTest(controllers = { AuthController.class, LoteController.class })
@Import({ SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class })
@TestPropertySource(properties = {
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443",
        "app.limite.login-por-minuto=5",
        "app.limite.lotes-por-minuto=2",
        "app.limite.cabecalho-ip=X-Real-IP" })
class LimiteDeRequisicoesTest {

    private static final String LOGIN = "{\"usuario\":\"alguem\",\"senha\":\"senha-errada\"}";
    private static final String LOTE = "{\"processoId\":1,\"pecas\":1,\"litros\":10}";

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean AuthService authService;
    @MockitoBean UsuarioService usuarioService;
    @MockitoBean LoteService loteService;

    private ResultActions entrar(String ip) throws Exception {
        return mvc.perform(post("/auth/login").header("X-Real-IP", ip)
                .contentType(MediaType.APPLICATION_JSON).content(LOGIN));
    }

    private String tokenDe(int id) {
        Usuario u = new Usuario("Sensor " + id, "sensor" + id, "x".repeat(60), Perfil.operador);
        ReflectionTestUtils.setField(u, "id", id);
        when(usuarios.findById(id)).thenReturn(Optional.of(u));
        return "Bearer " + jwt.gerar(id);
    }

    private ResultActions registrar(String token) throws Exception {
        return mvc.perform(post("/lotes").header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON).content(LOTE));
    }

    @Test
    void sextaTentativaDeLoginRecebe429SemChegarAoServico() throws Exception {
        when(authService.login(any())).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED,
                "CREDENCIAIS_INVALIDAS", "Usuário ou senha incorretos.", null));

        for (int i = 0; i < 5; i++) entrar("10.0.0.1").andExpect(status().isUnauthorized());

        entrar("10.0.0.1")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.codigo").value("LIMITE_EXCEDIDO"));
        verify(authService, times(5)).login(any());
    }

    @Test
    void limiteDeUmIpNaoBloqueiaOutro() throws Exception {
        when(authService.login(any())).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED,
                "CREDENCIAIS_INVALIDAS", "Usuário ou senha incorretos.", null));

        for (int i = 0; i < 6; i++) entrar("10.0.0.2");

        entrar("10.0.0.2").andExpect(status().isTooManyRequests());
        entrar("10.0.0.3").andExpect(status().isUnauthorized());
    }

    @Test
    void cabecalhoForjadoNaoEscapaDoLimite() throws Exception {
        when(authService.login(any())).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED,
                "CREDENCIAIS_INVALIDAS", "Usuário ou senha incorretos.", null));

        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/auth/login").header("X-Real-IP", "10.0.0.4").header("X-Forwarded-For", "1.2.3." + i)
                    .contentType(MediaType.APPLICATION_JSON).content(LOGIN));
        }

        mvc.perform(post("/auth/login").header("X-Real-IP", "10.0.0.4").header("X-Forwarded-For", "9.9.9.9")
                        .contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void lotesTemLimitePorUsuarioESemAfetarConsultas() throws Exception {
        String sensor = tokenDe(50);
        String outro = tokenDe(51);

        registrar(sensor).andExpect(status().isCreated());
        registrar(sensor).andExpect(status().isCreated());
        registrar(sensor)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER));
        verify(loteService, times(2)).registrar(any(), any());

        registrar(outro).andExpect(status().isCreated());
        mvc.perform(get("/lotes").header(HttpHeaders.AUTHORIZATION, sensor)).andExpect(status().isOk());
    }

    @Test
    void limiteVoltaDepoisDeUmMinuto() {
        AtomicLong agora = new AtomicLong();
        Limitador limitador = new Limitador(2, agora::get);

        assertThat(limitador.consumir("a")).isZero();
        assertThat(limitador.consumir("a")).isZero();
        assertThat(limitador.consumir("a")).isBetween(1L, 61L);

        agora.addAndGet(Duration.ofSeconds(61).toNanos());
        assertThat(limitador.consumir("a")).isZero();
    }

    @Test
    void chavesAntigasSaemDaMemoria() {
        AtomicLong agora = new AtomicLong();
        Limitador limitador = new Limitador(5, agora::get);

        for (int i = 0; i < Limitador.MAX_CHAVES; i++) limitador.consumir("ip-" + i);
        agora.addAndGet(Duration.ofMinutes(2).toNanos());
        limitador.consumir("novo");

        assertThat(limitador.chavesNaMemoria()).isEqualTo(1);
    }
}
