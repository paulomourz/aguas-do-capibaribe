package br.com.aguas.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import br.com.aguas.config.SecurityConfig;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.PrecoM3;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.PrecoM3Repository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;
import br.com.aguas.service.PrecoM3Service;

/**
 * Preço do m³ (custo da água): só gestor e admin listam e cadastram; quem cadastrou vem do token;
 * valor zero, negativo, com 3 casas ou sem data volta com o erro no campo, e nada chega ao banco.
 * Usa o PrecoM3Service real com os repositórios simulados.
 */
@WebMvcTest(controllers = PrecoM3Controller.class)
@Import({ PrecoM3Service.class, SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class, EventosDeSeguranca.class })
@TestPropertySource(properties = {
        "app.limite.login-por-minuto=100000",
        "app.limite.lotes-por-minuto=100000",
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443" })
class PrecoM3ControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean PrecoM3Repository precos;

    private String gestor;

    @BeforeEach
    void contas() {
        gestor = token(1, "Gestora", Perfil.gestor);
        when(precos.save(any(PrecoM3.class))).thenAnswer(i -> {
            PrecoM3 p = i.getArgument(0);
            ReflectionTestUtils.setField(p, "id", 10);
            ReflectionTestUtils.setField(p, "cadastradoEm", OffsetDateTime.parse("2026-11-24T10:00:00-03:00"));
            return p;
        });
    }

    private String token(int id, String nome, Perfil perfil) {
        Usuario u = new Usuario(nome, perfil.name() + id, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        when(usuarios.findById(id)).thenReturn(Optional.of(u));
        when(usuarios.findAllById(any())).thenAnswer(i -> List.of(u));
        return "Bearer " + jwt.gerar(id);
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, String quem, String corpo) throws Exception {
        return mvc.perform(req.header(HttpHeaders.AUTHORIZATION, quem).contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    private static PrecoM3 preco(int id, String valor, String vigencia, String cadastradoEm) {
        PrecoM3 p = new PrecoM3(new BigDecimal(valor), LocalDate.parse(vigencia), 1);
        ReflectionTestUtils.setField(p, "id", id);
        ReflectionTestUtils.setField(p, "cadastradoEm", OffsetDateTime.parse(cadastradoEm));
        return p;
    }

    @Test
    void operadorESensorRecebem403AoListarECadastrar() throws Exception {
        for (String quem : List.of(token(2, "Operador", Perfil.operador), token(3, "Sensor", Perfil.sensor))) {
            mvc.perform(get("/precos-m3").header(HttpHeaders.AUTHORIZATION, quem)).andExpect(status().isForbidden());
            enviar(post("/precos-m3"), quem, "{\"valor\":12.5,\"vigencia\":\"2026-11-01\"}").andExpect(status().isForbidden());
        }
        verify(precos, never()).save(any());
    }

    @Test
    void gestorCadastraEQuemCadastrouVemDoTokenMesmoComOutroNoCorpo() throws Exception {
        enviar(post("/precos-m3"), gestor, "{\"valor\":12.5,\"vigencia\":\"2026-11-01\",\"usuarioId\":99,\"cadastradoPor\":\"Outro\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.valor").value(12.5))
                .andExpect(jsonPath("$.vigencia").value("2026-11-01"))
                .andExpect(jsonPath("$.cadastradoPor").value("Gestora"))
                .andExpect(jsonPath("$.cadastradoEm").value("2026-11-24T13:00:00Z"));
        ArgumentCaptor<PrecoM3> salvo = ArgumentCaptor.forClass(PrecoM3.class);
        verify(precos).save(salvo.capture());
        assertEquals(1, salvo.getValue().getUsuarioId());
    }

    @Test
    void adminTambemCadastra() throws Exception {
        String admin = token(4, "Admin", Perfil.admin);
        enviar(post("/precos-m3"), admin, "{\"valor\":8,\"vigencia\":\"2026-01-15\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cadastradoPor").value("Admin"));
    }

    @Test
    void valorZeroOuNegativoRetorna422NoCampoValor() throws Exception {
        for (String valor : List.of("0", "-3.5")) {
            enviar(post("/precos-m3"), gestor, "{\"valor\":" + valor + ",\"vigencia\":\"2026-11-01\"}")
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                    .andExpect(jsonPath("$.campos.valor").value("O preço do m³ deve ser maior que zero."));
        }
        verify(precos, never()).save(any());
    }

    @Test
    void valorComTresCasasRetorna422() throws Exception {
        enviar(post("/precos-m3"), gestor, "{\"valor\":12.345,\"vigencia\":\"2026-11-01\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.valor").value("O preço do m³ aceita até 8 dígitos inteiros e 2 casas decimais."));
        verify(precos, never()).save(any());
    }

    @Test
    void semDataESemValorRetorna422NosDoisCampos() throws Exception {
        enviar(post("/precos-m3"), gestor, "{}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.valor").value("Informe o preço do m³."))
                .andExpect(jsonPath("$.campos.vigencia").value("Informe a data a partir da qual o preço vale."));
        verify(precos, never()).save(any());
    }

    @Test
    void listagemOrdenadaPorVigenciaEDepoisPorCadastroComONomeDeQuemCadastrou() throws Exception {
        when(precos.findAll()).thenReturn(List.of(
                preco(3, "9.00", "2026-11-01", "2026-11-20T10:00:00Z"),
                preco(1, "7.00", "2026-01-01", "2026-01-02T10:00:00Z"),
                preco(2, "8.00", "2026-11-01", "2026-11-05T10:00:00Z")));
        mvc.perform(get("/precos-m3").header(HttpHeaders.AUTHORIZATION, gestor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(org.hamcrest.Matchers.contains(1, 2, 3)))
                .andExpect(jsonPath("$[0].cadastradoPor").value("Gestora"))
                .andExpect(jsonPath("$[0].vigencia").value("2026-01-01"));
    }

    @Test
    void naoHaRotaParaEditarNemApagar() throws Exception {
        enviar(put("/precos-m3/1"), gestor, "{\"valor\":1,\"vigencia\":\"2026-11-01\"}").andExpect(status().is4xxClientError());
        mvc.perform(delete("/precos-m3/1").header(HttpHeaders.AUTHORIZATION, gestor)).andExpect(status().is4xxClientError());
        verify(precos, never()).save(any());
        verify(precos, never()).deleteById(any());
    }
}
