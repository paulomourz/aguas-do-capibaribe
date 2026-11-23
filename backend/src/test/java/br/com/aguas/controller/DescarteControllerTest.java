package br.com.aguas.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import br.com.aguas.dto.DescarteDTOs.DescarteDTO;
import br.com.aguas.dto.DescarteDTOs.NovoDescarteDTO;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.DescarteService;

/**
 * Camada web de /api/lotes/{id}/descartes (issue #201): segurança real e DescarteService simulado, sem banco.
 * Cobre 201, 422 (cada regra de validação; o serviço nunca é chamado), 404, 403 (sensor) e 401.
 */
@WebMvcTest(controllers = DescarteController.class)
@Import({ SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class, EventosDeSeguranca.class })
@TestPropertySource(properties = {
        "app.limite.login-por-minuto=100000",
        "app.limite.lotes-por-minuto=100000",
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443" })
class DescarteControllerTest {

    private static final int GESTOR_ID = 3;
    private static final int SENSOR_ID = 7;
    private static final String VALIDO = "{\"volumeLitros\":350.5,\"ph\":7.2,\"turbidezNtu\":40,\"reutilizadoPercentual\":30}";

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean DescarteService descartes;

    @BeforeEach
    void contas() {
        cadastrar(GESTOR_ID, "capibaribe.gestor", Perfil.gestor);
        cadastrar(SENSOR_ID, "sensor.wokwi", Perfil.sensor);
    }

    private void cadastrar(int id, String login, Perfil perfil) {
        Usuario u = new Usuario("Pessoa " + login, login, "x".repeat(60), perfil);
        ReflectionTestUtils.setField(u, "id", id);
        when(usuarios.findById(id)).thenReturn(Optional.of(u));
    }

    private ResultActions enviar(Integer quem, MockHttpServletRequestBuilder req) throws Exception {
        if (quem != null) req.header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.gerar(quem));
        return mvc.perform(req);
    }

    private MockHttpServletRequestBuilder novo(String corpo) {
        return post("/lotes/10/descartes").contentType(MediaType.APPLICATION_JSON).content(corpo);
    }

    private static DescarteDTO gravado() {
        return new DescarteDTO(5, 10, Instant.parse("2026-11-23T15:00:00Z"), new BigDecimal("350.50"),
                new BigDecimal("7.20"), new BigDecimal("40.00"), new BigDecimal("30.00"));
    }

    @Test
    void descarteValidoDoGestorRetorna201ComODescarteGravado() throws Exception {
        when(descartes.registrar(any(), eq(10), any())).thenReturn(gravado());
        enviar(GESTOR_ID, novo(VALIDO))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.loteId").value(10))
                .andExpect(jsonPath("$.ph").value(7.20))
                .andExpect(jsonPath("$.data").value("2026-11-23T15:00:00Z"));
        verify(descartes).registrar(new UsuarioAutenticado(GESTOR_ID, Perfil.gestor), 10,
                new NovoDescarteDTO(new BigDecimal("350.5"), new BigDecimal("7.2"), new BigDecimal("40"), new BigDecimal("30")));
    }

    @Test
    void semOReaproveitamentoTambemRetorna201() throws Exception {
        when(descartes.registrar(any(), eq(10), any())).thenReturn(gravado());
        enviar(GESTOR_ID, novo("{\"volumeLitros\":100,\"ph\":7,\"turbidezNtu\":0}")).andExpect(status().isCreated());
    }

    @ParameterizedTest(name = "{0} = {1} → 422")
    @CsvSource(delimiter = '|', value = {
            "volumeLitros | {\"volumeLitros\":0,\"ph\":7,\"turbidezNtu\":10}",
            "volumeLitros | {\"ph\":7,\"turbidezNtu\":10}",
            "ph           | {\"volumeLitros\":100,\"ph\":15,\"turbidezNtu\":10}",
            "ph           | {\"volumeLitros\":100,\"ph\":-0.5,\"turbidezNtu\":10}",
            "ph           | {\"volumeLitros\":100,\"turbidezNtu\":10}",
            "turbidezNtu  | {\"volumeLitros\":100,\"ph\":7,\"turbidezNtu\":-1}",
            "turbidezNtu  | {\"volumeLitros\":100,\"ph\":7}",
            "reutilizadoPercentual | {\"volumeLitros\":100,\"ph\":7,\"turbidezNtu\":10,\"reutilizadoPercentual\":101}",
            "reutilizadoPercentual | {\"volumeLitros\":100,\"ph\":7,\"turbidezNtu\":10,\"reutilizadoPercentual\":-1}" })
    void campoForaDaFaixaRetorna422NoCampoSemChamarOServico(String campo, String corpo) throws Exception {
        enviar(GESTOR_ID, novo(corpo))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.campos." + campo).exists());
        verify(descartes, never()).registrar(any(), any(), any());
    }

    @Test
    void loteQueNaoExisteOuQueOOperadorNaoAlcancaRetorna404() throws Exception {
        when(descartes.registrar(any(), eq(10), any())).thenThrow(ApiException.naoEncontrado("Lote não encontrado."));
        enviar(GESTOR_ID, novo(VALIDO)).andExpect(status().isNotFound()).andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
    }

    @Test
    void listaOsDescartesDoLote() throws Exception {
        when(descartes.listar(new UsuarioAutenticado(GESTOR_ID, Perfil.gestor), 10)).thenReturn(List.of(gravado()));
        enviar(GESTOR_ID, get("/lotes/10/descartes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].reutilizadoPercentual").value(30.00));
    }

    @Test
    void sensorNaoRegistraNemConsultaDescartes() throws Exception {
        enviar(SENSOR_ID, novo(VALIDO)).andExpect(status().isForbidden());
        enviar(SENSOR_ID, get("/lotes/10/descartes")).andExpect(status().isForbidden());
        verify(descartes, never()).registrar(any(), any(), any());
    }

    @Test
    void semTokenRetorna401() throws Exception {
        enviar(null, novo(VALIDO)).andExpect(status().isUnauthorized());
        enviar(null, get("/lotes/10/descartes")).andExpect(status().isUnauthorized());
    }
}
