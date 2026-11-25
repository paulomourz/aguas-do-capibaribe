package br.com.aguas.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import br.com.aguas.config.SecurityConfig;
import br.com.aguas.dto.TelemetriaDTO;
import br.com.aguas.dto.TelemetriaRequestDTO;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.EventosDeSeguranca;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;
import br.com.aguas.security.TokenDeApi;
import br.com.aguas.security.UsuarioAutenticado;
import br.com.aguas.service.TelemetriaService;

/**
 * Camada web de POST /api/telemetria (issue #157, RNF07): slice @WebMvcTest com a segurança real e o
 * TelemetriaService simulado (@MockitoBean, o substituto do @MockBean, descontinuado no Spring Boot 3.4).
 * Nenhum banco: o UsuarioRepository também é simulado. Cobre 201 (sucesso), 400 (validação, issue #156) e
 * 401 (sem token, token JWT inválido e token de sensor desconhecido).
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

    private static final int SENSOR_ID = 7;
    private static final String LEITURA_VALIDA = "{\"processoId\":1,\"vazaoLitros\":12.50}";
    /** Chave no formato do token de API (64 letras e números), como a gerada em Usuários > Rotacionar token. */
    private static final String CHAVE_SENSOR = TokenDeApi.gerar();

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean TelemetriaService telemetrias;

    private Usuario sensor;

    @BeforeEach
    void sensorCadastrado() {
        sensor = new Usuario("Sensor Wokwi", "sensor.wokwi", "x".repeat(60), Perfil.sensor);
        ReflectionTestUtils.setField(sensor, "id", SENSOR_ID);
        when(usuarios.findById(SENSOR_ID)).thenReturn(Optional.of(sensor));
        when(usuarios.findByTokenHash(TokenDeApi.hash(CHAVE_SENSOR))).thenReturn(Optional.of(sensor));
    }

    private ResultActions enviar(String autorizacao, String corpo) throws Exception {
        MockHttpServletRequestBuilder req = post("/telemetria").contentType(MediaType.APPLICATION_JSON).content(corpo);
        if (autorizacao != null) req.header(HttpHeaders.AUTHORIZATION, autorizacao);
        return mvc.perform(req);
    }

    private ResultActions enviarComoSensor(String corpo) throws Exception {
        return enviar("Bearer " + CHAVE_SENSOR, corpo);
    }

    private void servicoGrava() {
        when(telemetrias.registrar(any(), any())).thenAnswer(i -> {
            TelemetriaRequestDTO leitura = i.getArgument(1);
            return new TelemetriaDTO(42, leitura.processoId(), leitura.vazaoLitros(), Instant.parse("2026-11-18T12:00:00Z"));
        });
    }

    @Nested
    class Sucesso201 {

        @Test
        void leituraValidaDoSensorPeloTokenDeApiRetorna201ComALeituraGravada() throws Exception {
            servicoGrava();
            enviarComoSensor(LEITURA_VALIDA)
                    .andExpect(status().isCreated())
                    .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE))
                    .andExpect(jsonPath("$.id").value(42))
                    .andExpect(jsonPath("$.processoId").value(1))
                    .andExpect(jsonPath("$.vazaoLitros").value(12.50))
                    .andExpect(jsonPath("$.data").value("2026-11-18T12:00:00Z"));
            verify(telemetrias).registrar(new UsuarioAutenticado(SENSOR_ID, Perfil.sensor),
                    new TelemetriaRequestDTO(1, new BigDecimal("12.50")));
        }

        @Test
        void leituraValidaComJwtTambemRetorna201() throws Exception {
            servicoGrava();
            enviar("Bearer " + jwt.gerar(SENSOR_ID), LEITURA_VALIDA).andExpect(status().isCreated());
            verify(telemetrias).registrar(eq(new UsuarioAutenticado(SENSOR_ID, Perfil.sensor)), any());
        }

        @Test
        void vazaoZeroEhAceita() throws Exception {
            servicoGrava();
            enviarComoSensor("{\"processoId\":1,\"vazaoLitros\":0}")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.vazaoLitros").value(0));
        }

        @Test
        void vazaoNoLimiteDe10000EhAceita() throws Exception {
            servicoGrava();
            enviarComoSensor("{\"processoId\":1,\"vazaoLitros\":10000.00}").andExpect(status().isCreated());
        }
    }

    /** Issue #156 (RNF04): campo nulo, negativo ou fora da faixa → 400 estruturado, e o serviço nunca é chamado. */
    @Nested
    class Validacao400 {

        private void recusada(String corpo, String campo, String mensagem) throws Exception {
            enviarComoSensor(corpo)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.codigo").value("TELEMETRIA_INVALIDA"))
                    .andExpect(jsonPath("$.mensagem").value("Leitura de telemetria recusada. Verifique os campos informados."))
                    .andExpect(jsonPath("$.campos." + campo).value(mensagem));
            verify(telemetrias, never()).registrar(any(), any());
        }

        @Test
        void vazaoNula() throws Exception {
            recusada("{\"processoId\":1,\"vazaoLitros\":null}", "vazaoLitros", "Informe a vazão em litros.");
        }

        @Test
        void vazaoAusente() throws Exception {
            recusada("{\"processoId\":1}", "vazaoLitros", "Informe a vazão em litros.");
        }

        @Test
        void vazaoNegativa() throws Exception {
            recusada("{\"processoId\":1,\"vazaoLitros\":-3.5}", "vazaoLitros", "A vazão em litros não pode ser negativa.");
        }

        @Test
        void vazaoAcimaDoMaximo() throws Exception {
            recusada("{\"processoId\":1,\"vazaoLitros\":10000.01}", "vazaoLitros", "A vazão em litros não pode passar de 10000.");
        }

        @Test
        void vazaoComTresCasasDecimais() throws Exception {
            recusada("{\"processoId\":1,\"vazaoLitros\":1.234}", "vazaoLitros",
                    "A vazão aceita até 5 dígitos inteiros e 2 casas decimais.");
        }

        @Test
        void processoAusente() throws Exception {
            recusada("{\"vazaoLitros\":5}", "processoId", "Informe o processo da leitura.");
        }

        @Test
        void processoZero() throws Exception {
            recusada("{\"processoId\":0,\"vazaoLitros\":5}", "processoId",
                    "O processo deve ser um número inteiro maior que zero.");
        }

        @Test
        void doisCamposInvalidosVoltamJuntos() throws Exception {
            enviarComoSensor("{\"processoId\":null,\"vazaoLitros\":-1}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.campos.processoId").exists())
                    .andExpect(jsonPath("$.campos.vazaoLitros").exists());
            verify(telemetrias, never()).registrar(any(), any());
        }

        @Test
        void jsonMalformadoRetorna400RequisicaoInvalida() throws Exception {
            enviarComoSensor("{\"processoId\":1,\"vazaoLitros\":")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.codigo").value("REQUISICAO_INVALIDA"));
            verify(telemetrias, never()).registrar(any(), any());
        }
    }

    /** Sem autenticação válida, a segurança responde antes do controller: o serviço nunca é chamado. */
    @Nested
    class NaoAutenticado401 {

        private void recusada(String autorizacao) throws Exception {
            enviar(autorizacao, LEITURA_VALIDA)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
            verify(telemetrias, never()).registrar(any(), any());
        }

        @Test
        void semCabecalhoAuthorization() throws Exception {
            recusada(null);
        }

        @Test
        void tokenDeSensorDesconhecidoOuRotacionado() throws Exception {
            recusada("Bearer " + TokenDeApi.gerar());
        }

        @Test
        void tokenDeSensorDeContaDesativada() throws Exception {
            ReflectionTestUtils.setField(sensor, "ativo", false);
            recusada("Bearer " + CHAVE_SENSOR);
        }

        @Test
        void jwtInvalido() throws Exception {
            recusada("Bearer nao.e.um.jwt");
        }
    }

    @Test
    void processoInexistenteRetorna422DoServico() throws Exception {
        when(telemetrias.registrar(any(), any()))
                .thenThrow(ApiException.validacao("processoId", "Selecione um processo válido."));
        enviarComoSensor("{\"processoId\":999,\"vazaoLitros\":5}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.campos.processoId").value("Selecione um processo válido."));
    }
}
