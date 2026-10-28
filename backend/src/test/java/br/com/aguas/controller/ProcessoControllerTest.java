package br.com.aguas.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
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
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.Unidade;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.ProcessoRepository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.ConversorJwt;
import br.com.aguas.security.JwtService;
import br.com.aguas.security.RespostasDeSeguranca;
import br.com.aguas.service.ProcessoService;

/**
 * Cadastro e edição de processos (US-02, issue #17): meta zero ou negativa, campos faltando e nome repetido
 * voltam com o erro no campo certo, e nada chega ao banco. Usa o ProcessoService real com o repositório simulado.
 */
@WebMvcTest(controllers = ProcessoController.class)
@Import({ ProcessoService.class, SecurityConfig.class, ConversorJwt.class, JwtService.class, RespostasDeSeguranca.class })
@TestPropertySource(properties = {
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.jwt.expiracao=8h",
        "app.cors-origens=http://localhost:8443" })
class ProcessoControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;

    @MockitoBean UsuarioRepository usuarios;
    @MockitoBean ProcessoRepository processos;

    private String token;

    @BeforeEach
    void gestorLogado() {
        Usuario u = new Usuario("Gestora", "gestora", "x".repeat(60), Perfil.gestor);
        ReflectionTestUtils.setField(u, "id", 1);
        when(usuarios.findById(1)).thenReturn(Optional.of(u));
        token = "Bearer " + jwt.gerar(1);
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, String corpo) throws Exception {
        return mvc.perform(req.header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    private Processo existente(int id, String nome) {
        Processo p = new Processo(nome, Unidade.peca, new BigDecimal("12.00"));
        ReflectionTestUtils.setField(p, "id", id);
        when(processos.findById(id)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void estonagemSuaveComMetaZeroPorPecaRetorna422NoCampoMeta() throws Exception {
        enviar(post("/processos"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"peca\",\"meta\":0}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.campos.meta").value("A meta deve ser maior que zero."))
                .andExpect(jsonPath("$.campos.nome").doesNotExist());
        verify(processos, never()).save(any());
    }

    @Test
    void metaNegativaRetorna422() throws Exception {
        enviar(post("/processos"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"lote\",\"meta\":-5.5}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.meta").value("A meta deve ser maior que zero."));
        verify(processos, never()).save(any());
    }

    @Test
    void semUnidadeESemMetaRetorna422NosDoisCampos() throws Exception {
        enviar(post("/processos"), "{\"nome\":\"Estonagem Suave\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.unidade").value("Escolha a unidade da meta."))
                .andExpect(jsonPath("$.campos.meta").value("Informe o valor da meta."));
        verify(processos, never()).save(any());
    }

    @Test
    void unidadeInexistenteRetorna400() throws Exception {
        enviar(post("/processos"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"litro\",\"meta\":10}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("REQUISICAO_INVALIDA"));
        verify(processos, never()).save(any());
    }

    @Test
    void nomeRepetidoAoCriarRetorna409NoCampoNome() throws Exception {
        when(processos.existsByNomeIgnoreCase("Estonagem Suave")).thenReturn(true);
        enviar(post("/processos"), "{\"nome\":\"  Estonagem Suave \",\"unidade\":\"peca\",\"meta\":12}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PROCESSO_DUPLICADO"))
                .andExpect(jsonPath("$.campos.nome").value("Já existe um processo com esse nome."));
        verify(processos, never()).save(any());
    }

    @Test
    void processoValidoECriadoComNomeSemEspacos() throws Exception {
        when(processos.save(any(Processo.class))).thenAnswer(i -> {
            Processo p = i.getArgument(0);
            ReflectionTestUtils.setField(p, "id", 10);
            return p;
        });
        enviar(post("/processos"), "{\"nome\":\"  Estonagem Suave \",\"unidade\":\"peca\",\"meta\":12.5}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.nome").value("Estonagem Suave"))
                .andExpect(jsonPath("$.unidade").value("peca"))
                .andExpect(jsonPath("$.meta").value(12.5));
    }

    @Test
    void edicaoComMetaZeroRetorna422ENaoAlteraOProcesso() throws Exception {
        Processo p = existente(2, "Estonagem Suave");
        enviar(put("/processos/2"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"peca\",\"meta\":0}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.meta").value("A meta deve ser maior que zero."));
        assertEquals(new BigDecimal("12.00"), p.getMeta());
    }

    @Test
    void edicaoComNomeDeOutroProcessoRetorna409() throws Exception {
        Processo p = existente(2, "Estonagem Suave");
        when(processos.existsByNomeIgnoreCaseAndIdNot("Tingimento", 2)).thenReturn(true);
        enviar(put("/processos/2"), "{\"nome\":\"Tingimento\",\"unidade\":\"peca\",\"meta\":12}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PROCESSO_DUPLICADO"))
                .andExpect(jsonPath("$.campos.nome").exists());
        assertEquals("Estonagem Suave", p.getNome());
    }

    @Test
    void edicaoMantendoOProprioNomeEPermitida() throws Exception {
        existente(2, "Estonagem Suave");
        enviar(put("/processos/2"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"peca\",\"meta\":9.75}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meta").value(9.75));
    }

    @Test
    void edicaoDeProcessoInexistenteRetorna404() throws Exception {
        when(processos.findById(99)).thenReturn(Optional.empty());
        enviar(put("/processos/99"), "{\"nome\":\"Estonagem Suave\",\"unidade\":\"peca\",\"meta\":12}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
    }
}
