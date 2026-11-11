package br.com.aguas.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import br.com.aguas.config.SecurityConfig;
import br.com.aguas.controller.AuthController;
import br.com.aguas.controller.ProcessoController;
import br.com.aguas.controller.RelatorioController;
import br.com.aguas.controller.UsuarioController;
import br.com.aguas.dto.UsuarioDTOs.TokenDeApiDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.service.AuthService;
import br.com.aguas.service.ProcessoService;
import br.com.aguas.service.RelatorioService;
import br.com.aguas.service.UsuarioService;

/** Segurança, validação e formato de erro dos endpoints, sem banco (serviços simulados). */
@WebMvcTest(controllers = { UsuarioController.class, ProcessoController.class, AuthController.class, RelatorioController.class })
@Import({ SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class })
@TestPropertySource(properties = {
        "app.limite.login-por-minuto=100000",
        "app.limite.lotes-por-minuto=100000",
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443" })
class SegurancaWebTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean UsuarioService usuarioService;
    @MockitoBean ProcessoService processoService;
    @MockitoBean AuthService authService;
    @MockitoBean RelatorioService relatorioService;

    private String tokenDe(int id, Perfil perfil, boolean ativo) {
        Usuario u = new Usuario("Pessoa " + id, "pessoa" + id, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        u.setAtivo(ativo);
        when(usuarios.findById(id)).thenReturn(Optional.of(u));
        return "Bearer " + jwt.gerar(id);
    }

    @Test
    void semTokenRetorna401NoFormatoDoFront() throws Exception {
        mvc.perform(get("/usuarios"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensagem").isString());
    }

    @Test
    void documentacaoSwaggerNaoPedeToken() throws Exception {
        // Aqui o springdoc não é carregado (teste fatiado): só se confere que a segurança libera as rotas.
        for (String rota : List.of("/v3/api-docs", "/swagger-ui.html", "/swagger-ui/index.html")) {
            mvc.perform(get(rota)).andExpect(r -> org.junit.jupiter.api.Assertions.assertNotEquals(401, r.getResponse().getStatus(), rota));
        }
        // Escrever na documentação continua bloqueado.
        mvc.perform(post("/v3/api-docs")).andExpect(status().isUnauthorized());
    }

    @Test
    void tokenAdulteradoRetorna401() throws Exception {
        String token = tokenDe(1, Perfil.gestor, true);
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, token + "x"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioDesativadoPerdeAcessoMesmoComTokenValido() throws Exception {
        String token = tokenDe(2, Perfil.gestor, false);
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void operadorNaoAcessaFuncoesDeGestor() throws Exception {
        String token = tokenDe(3, Perfil.operador, true);
        mvc.perform(get("/usuarios").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("ACESSO_NEGADO"));
        mvc.perform(post("/processos").header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nome\":\"X\",\"unidade\":\"lote\",\"meta\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/relatorios/resumo?mes=9&ano=2026").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/usuarios/5/senha").header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"senha\":\"nova-senha-123\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void operadorListaProcessos() throws Exception {
        String token = tokenDe(4, Perfil.operador, true);
        when(processoService.listar()).thenReturn(List.of());
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isOk());
    }

    @Test
    void gestorListaUsuarios() throws Exception {
        String token = tokenDe(5, Perfil.gestor, true);
        when(usuarioService.listar(any())).thenReturn(List.of(new UsuarioDTO(5, "Gestora", "gestora", Perfil.gestor, true)));
        mvc.perform(get("/usuarios").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].usuario").value("gestora"))
                .andExpect(jsonPath("$[0].perfil").value("gestor"));
    }

    @Test
    void loginComCamposVaziosRetorna422ComCampos() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"usuario\":\"\",\"senha\":\"\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.campos.usuario").exists())
                .andExpect(jsonPath("$.campos.senha").exists());
    }

    @Test
    void corpoMalformadoRetorna400() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{nao é json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("REQUISICAO_INVALIDA"));
    }

    @Test
    void validacoesDeProcessoAlinhadasAoBanco() throws Exception {
        String token = tokenDe(6, Perfil.gestor, true);
        mvc.perform(post("/processos").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"  \",\"unidade\":\"lote\",\"meta\":0}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.nome").exists())
                .andExpect(jsonPath("$.campos.meta").exists());
        mvc.perform(post("/processos").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"" + "a".repeat(81) + "\",\"unidade\":\"lote\",\"meta\":1.234}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.nome").exists())
                .andExpect(jsonPath("$.campos.meta").exists());
    }

    @Test
    void loginDeUsuarioRespeitaCheckDoBanco() throws Exception {
        String token = tokenDe(7, Perfil.admin, true);
        mvc.perform(post("/usuarios").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Ana\",\"usuario\":\"ab\",\"perfil\":\"operador\",\"senha\":\"12345678\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.usuario").exists());
        mvc.perform(post("/usuarios").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Ana\",\"usuario\":\"ana.silva\",\"perfil\":\"operador\",\"senha\":\"curta\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.senha").exists());
    }

    @Test
    void mesInvalidoNoRelatorioRetorna422() throws Exception {
        String token = tokenDe(8, Perfil.gestor, true);
        when(relatorioService.resumoDoMes(any(Integer.class), any(Integer.class))).thenReturn(List.of());
        mvc.perform(get("/relatorios/resumo?mes=13&ano=2026").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.mes").exists());
    }

    @Test
    void corsLiberaSomenteOrigemConfigurada() throws Exception {
        mvc.perform(options("/processos").header(HttpHeaders.ORIGIN, "http://localhost:8443")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:8443"));
        mvc.perform(options("/processos").header(HttpHeaders.ORIGIN, "http://outro-site.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden());
    }

    // ---------- token de API do sensor ----------

    private Usuario sensorComToken(int id, String chave, boolean ativo) {
        Usuario u = new Usuario("Sensor " + id, "sensor" + id, "x".repeat(60), Perfil.sensor);
        ReflectionTestUtils.setField(u, "id", id);
        u.setAtivo(ativo);
        u.setTokenHash(TokenDeApi.hash(chave));
        when(usuarios.findByTokenHash(TokenDeApi.hash(chave))).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void soAdministradorRotacionaToken() throws Exception {
        mvc.perform(post("/usuarios/20/token/rotacao")).andExpect(status().isUnauthorized());
        for (Perfil perfil : List.of(Perfil.gestor, Perfil.operador, Perfil.sensor)) {
            mvc.perform(post("/usuarios/20/token/rotacao").header(HttpHeaders.AUTHORIZATION, tokenDe(9, perfil, true)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.codigo").value("ACESSO_NEGADO"));
        }

        String chave = TokenDeApi.gerar();
        when(usuarioService.rotacionarToken(any(), any()))
                .thenReturn(new TokenDeApiDTO(chave, new UsuarioDTO(20, "Sensor", "sensor.wokwi", Perfil.sensor, true)));
        mvc.perform(post("/usuarios/20/token/rotacao").header(HttpHeaders.AUTHORIZATION, tokenDe(10, Perfil.admin, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(chave))
                .andExpect(jsonPath("$.usuario.perfil").value("sensor"));
    }

    @Test
    void sensorEntraComTokenDeApiEFicaNoPerfilDele() throws Exception {
        String chave = TokenDeApi.gerar();
        sensorComToken(21, chave, true);
        when(processoService.listar()).thenReturn(List.of());

        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + chave)).andExpect(status().isOk());
        // O token de API não dá mais acesso do que o perfil sensor: nem usuários, nem a própria rotação.
        mvc.perform(get("/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + chave)).andExpect(status().isForbidden());
        mvc.perform(post("/usuarios/21/token/rotacao").header(HttpHeaders.AUTHORIZATION, "Bearer " + chave))
                .andExpect(status().isForbidden());
    }

    @Test
    void tokenDeApiRevogadoDesconhecidoOuDeContaDesativadaRetorna401() throws Exception {
        String anterior = TokenDeApi.gerar();
        Usuario sensor = sensorComToken(22, anterior, true);
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + anterior)).andExpect(status().isOk());

        // Rotação: o hash da conta muda e a chave anterior não acha mais ninguém.
        String nova = TokenDeApi.gerar();
        when(usuarios.findByTokenHash(TokenDeApi.hash(anterior))).thenReturn(Optional.empty());
        sensor.setTokenHash(TokenDeApi.hash(nova));
        when(usuarios.findByTokenHash(TokenDeApi.hash(nova))).thenReturn(Optional.of(sensor));

        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + anterior))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + nova)).andExpect(status().isOk());

        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + TokenDeApi.gerar()))
                .andExpect(status().isUnauthorized());

        String deDesativada = TokenDeApi.gerar();
        sensorComToken(23, deDesativada, false);
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + deDesativada))
                .andExpect(status().isUnauthorized());
    }
}
