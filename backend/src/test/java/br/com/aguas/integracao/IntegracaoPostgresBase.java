package br.com.aguas.integracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Testes de integração contra um PostgreSQL criado a partir de database/banco.sql.
 * Nunca usam o banco real: as subclasses só aceitam um contêiner descartável
 * (IntegracaoPostgresContainerTest) ou um banco local cujo nome termina em "_teste"
 * (IntegracaoPostgresLocalTest).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.cors-origens=http://localhost:8443",
        "app.admin.senha=" + IntegracaoPostgresBase.SENHA_ADMIN })
abstract class IntegracaoPostgresBase {

    static final String SENHA_ADMIN = "admin-de-teste-123";

    private static final String SENHA = "senha-de-teste-123";

    /** Começa num valor da hora atual: logins e nomes não se repetem entre rodadas no mesmo banco de teste. */
    private static final AtomicInteger seq = new AtomicInteger((int) (System.currentTimeMillis() / 1000 % 1_000_000) * 1000);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;

    record Conta(int id, String login, String token) {}

    // ---------- auxiliares ----------

    private Conta conta(String perfil) throws Exception {
        String login = perfil + ".t" + seq.incrementAndGet();
        Integer id = jdbc.queryForObject(
                "insert into usuario (nome, login, senha_hash, perfil) values (?, ?, ?, ?) returning id",
                Integer.class, "Pessoa " + login, login, encoder.encode(SENHA), perfil);
        return new Conta(id, login, entrar(login, SENHA));
    }

    private String entrar(String login, String senha) throws Exception {
        String corpo = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("usuario", login, "senha", senha))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    private ResultActions chamar(MockHttpServletRequestBuilder req, Conta c) throws Exception {
        return mvc.perform(req.header(HttpHeaders.AUTHORIZATION, "Bearer " + c.token()));
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, Conta c, Object corpo) throws Exception {
        return chamar(req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)), c);
    }

    private JsonNode ler(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private int processo(Conta gestor, String unidade, String meta) throws Exception {
        var corpo = Map.of("nome", "Processo " + seq.incrementAndGet(), "unidade", unidade, "meta", new BigDecimal(meta));
        return ler(enviar(post("/processos"), gestor, corpo).andExpect(status().isCreated())).get("id").asInt();
    }

    private JsonNode lote(Conta quem, int processoId, int pecas, String litros) throws Exception {
        var corpo = Map.of("processoId", processoId, "pecas", pecas, "litros", new BigDecimal(litros));
        return ler(enviar(post("/lotes"), quem, corpo).andExpect(status().isCreated()));
    }

    private List<JsonNode> alertasDo(Conta gestor, int processoId) throws Exception {
        List<JsonNode> r = new ArrayList<>();
        ler(chamar(get("/alertas"), gestor).andExpect(status().isOk()))
                .forEach(a -> { if (a.get("processoId").asInt() == processoId) r.add(a); });
        return r;
    }

    private static List<Integer> ids(JsonNode arr) {
        List<Integer> r = new ArrayList<>();
        arr.forEach(n -> r.add(n.asInt()));
        return r;
    }

    // ---------- testes ----------

    @Test
    void conectaSomenteAoBancoDeTeste() throws Exception {
        try (var c = dataSource.getConnection()) {
            assertThat(c.getMetaData().getURL()).containsPattern("//(localhost|127\\.0\\.0\\.1):\\d+/\\w+_teste");
        }
    }

    @Test
    void loginMeESenhaErrada() throws Exception {
        Conta g = conta("gestor");
        chamar(get("/auth/me"), g).andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario").value(g.login()))
                .andExpect(jsonPath("$.perfil").value("gestor"));
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"" + g.login() + "\",\"senha\":\"errada-123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIAIS_INVALIDAS"));
        // login sem diferenciar maiúsculas, como no front
        assertThat(entrar(g.login().toUpperCase(), SENHA)).isNotBlank();
    }

    @Test
    void esperadoVemDoTriggerEDesvioDaFormulaDaView() throws Exception {
        Conta g = conta("gestor");
        int porPeca = processo(g, "peca", "12");
        JsonNode l1 = lote(g, porPeca, 100, "1290");
        assertThat(l1.get("esperado").decimalValue()).isEqualByComparingTo("1200");
        assertThat(l1.get("desvio").decimalValue()).isEqualByComparingTo("7.50");
        assertThat(l1.get("usuarioId").asInt()).isEqualTo(g.id());
        assertThat(l1.get("data").asText()).endsWith("Z");

        int porLote = processo(g, "lote", "800");
        JsonNode l2 = lote(g, porLote, 140, "760");
        assertThat(l2.get("esperado").decimalValue()).isEqualByComparingTo("800");
        assertThat(l2.get("desvio").decimalValue()).isEqualByComparingTo("-5.00");

        assertThat(l1.get("statusConformidade").asText()).isEqualTo("ATENCAO");
        assertThat(l2.get("statusConformidade").asText()).isEqualTo("DENTRO_DA_META");
        assertThat(lote(g, porLote, 140, "900").get("statusConformidade").asText()).isEqualTo("CRITICO");

        BigDecimal desvioView = jdbc.queryForObject("select desvio_percentual from v_historico_lotes where lote_id = ?",
                BigDecimal.class, l1.get("id").asInt());
        assertThat(desvioView).isEqualByComparingTo(l1.get("desvio").decimalValue());
    }

    @Test
    void loteNaoPodeSerAlteradoNemExcluido() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");
        int id = lote(g, p, 1, "50").get("id").asInt();
        assertThatThrownBy(() -> jdbc.update("update lote set litros = 1 where id = ?", id)).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("delete from lote where id = ?", id)).isInstanceOf(DataAccessException.class);
    }

    @Test
    void regraDeAlertaTresConsecutivosEAnexacao() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");

        lote(g, p, 1, "100");                       // igual ao esperado: não conta
        int a1 = lote(g, p, 1, "110").get("id").asInt();
        int a2 = lote(g, p, 1, "120").get("id").asInt();
        assertThat(alertasDo(g, p)).isEmpty();

        int a3 = lote(g, p, 1, "100.01").get("id").asInt();  // estritamente maior
        List<JsonNode> alertas = alertasDo(g, p);
        assertThat(alertas).hasSize(1);
        assertThat(alertas.get(0).get("status").asText()).isEqualTo("aberto");
        assertThat(ids(alertas.get(0).get("loteIds"))).containsExactly(a1, a2, a3);

        int a4 = lote(g, p, 1, "140").get("id").asInt();     // sequência continua: anexa
        assertThat(ids(alertasDo(g, p).get(0).get("loteIds"))).containsExactly(a1, a2, a3, a4);

        lote(g, p, 1, "90");                                 // quebra a sequência
        lote(g, p, 1, "150");
        lote(g, p, 1, "160");
        assertThat(alertasDo(g, p)).hasSize(1);
        lote(g, p, 1, "170");                                // nova sequência de 3 → novo alerta
        assertThat(alertasDo(g, p)).hasSize(2);

        Integer vinculados = jdbc.queryForObject(
                "select count(*) from alerta_lote al join alerta a on a.id = al.alerta_id where a.processo_id = ?", Integer.class, p);
        Integer distintos = jdbc.queryForObject(
                "select count(distinct al.lote_id) from alerta_lote al join alerta a on a.id = al.alerta_id where a.processo_id = ?", Integer.class, p);
        assertThat(vinculados).isEqualTo(7).isEqualTo(distintos);
    }

    @Test
    void alertaResolvidoNaoReaproveitaLotesETransicoesSaoValidadas() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");
        lote(g, p, 1, "200");
        lote(g, p, 1, "200");
        lote(g, p, 1, "200");
        int alertaId = alertasDo(g, p).get(0).get("id").asInt();

        enviar(patch("/alertas/" + alertaId + "/status"), g, Map.of("status", "analise"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("analise"));
        enviar(patch("/alertas/" + alertaId + "/status"), g, Map.of("status", "aberto"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("TRANSICAO_INVALIDA"));
        enviar(patch("/alertas/" + alertaId + "/status"), g, Map.of("status", "resolvido"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select atualizado_em is not null from alerta where id = ?", Boolean.class, alertaId)).isTrue();

        lote(g, p, 1, "200");
        lote(g, p, 1, "200");
        assertThat(alertasDo(g, p)).hasSize(1);   // lotes do alerta resolvido não entram em nova sequência
        lote(g, p, 1, "200");
        assertThat(alertasDo(g, p)).hasSize(2);

        chamar(get("/alertas?status=resolvido"), g).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + alertaId + ")]").exists());
    }

    @Test
    void operadorVeSoOsPropriosLotes() throws Exception {
        Conta g = conta("gestor");
        Conta op1 = conta("operador");
        Conta op2 = conta("operador");
        int p = processo(g, "peca", "10");
        int doOp1 = lote(op1, p, 5, "40").get("id").asInt();
        int doOp2 = lote(op2, p, 5, "40").get("id").asInt();

        List<Integer> vistos = new ArrayList<>();
        ler(chamar(get("/lotes?processoId=" + p), op1).andExpect(status().isOk())).forEach(l -> vistos.add(l.get("id").asInt()));
        assertThat(vistos).containsExactly(doOp1);
        chamar(get("/lotes/" + doOp2), op1).andExpect(status().isNotFound());

        List<Integer> doGestor = new ArrayList<>();
        ler(chamar(get("/lotes?processoId=" + p), g)).forEach(l -> doGestor.add(l.get("id").asInt()));
        assertThat(doGestor).containsExactly(doOp2, doOp1);   // mais recentes primeiro

        chamar(get("/usuarios"), op1).andExpect(status().isForbidden());
    }

    @Test
    void usuarioDesativadoPerdeAcessoNaProximaRequisicao() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        chamar(get("/processos"), op).andExpect(status().isOk());
        enviar(patch("/usuarios/" + op.id() + "/ativo"), g, Map.of("ativo", false)).andExpect(status().isOk());
        chamar(get("/processos"), op).andExpect(status().isUnauthorized());
        enviar(patch("/usuarios/" + g.id() + "/ativo"), g, Map.of("ativo", false))
                .andExpect(status().isConflict());
    }

    @Test
    void administradorPrincipalCriadoNaInicializacaoENaoPodeSerDesativado() throws Exception {
        assertThat(jdbc.queryForObject("select perfil from usuario where login = 'capibaribe.admin'", String.class))
                .isEqualTo("gestor");
        assertThat(entrar("capibaribe.admin", SENHA_ADMIN)).isNotBlank();

        Integer adminId = jdbc.queryForObject("select id from usuario where login = 'capibaribe.admin'", Integer.class);
        Conta g = conta("gestor");
        enviar(patch("/usuarios/" + adminId + "/ativo"), g, Map.of("ativo", false))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("OPERACAO_NAO_PERMITIDA"));
    }

    @Test
    void criarUsuarioEDuplicidade() throws Exception {
        Conta g = conta("gestor");
        String login = "novo.t" + seq.incrementAndGet();
        var corpo = Map.of("nome", "Nova Pessoa", "usuario", login, "perfil", "operador", "senha", "senha-nova-123");
        enviar(post("/usuarios"), g, corpo).andExpect(status().isCreated())
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.usuario").value(login));
        String hash = jdbc.queryForObject("select senha_hash from usuario where login = ?", String.class, login);
        assertThat(hash).hasSize(60).startsWith("$2");
        enviar(post("/usuarios"), g, corpo).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("USUARIO_DUPLICADO"))
                .andExpect(jsonPath("$.campos.usuario").exists());
    }

    @Test
    void trocaDeSenhaExigeSenhaAtual() throws Exception {
        Conta op = conta("operador");
        enviar(patch("/usuarios/" + op.id()), op, Map.of("senha", "outra-senha-456", "senhaAtual", "errada"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.senhaAtual").exists());
        enviar(patch("/usuarios/" + op.id()), op, Map.of("senha", "outra-senha-456"))
                .andExpect(status().isUnprocessableEntity());
        enviar(patch("/usuarios/" + op.id()), op, Map.of("senha", "outra-senha-456", "senhaAtual", SENHA))
                .andExpect(status().isOk());
        assertThat(entrar(op.login(), "outra-senha-456")).isNotBlank();

        Conta outro = conta("gestor");
        enviar(patch("/usuarios/" + outro.id()), op, Map.of("nome", "Invasor"))
                .andExpect(status().isForbidden());
    }

    @Test
    void gestorRedefineSenhaDeOutraPessoa() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        enviar(patch("/usuarios/" + op.id() + "/senha"), g, Map.of("senha", "curta"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.senha").exists());
        enviar(patch("/usuarios/" + op.id() + "/senha"), g, Map.of("senha", "redefinida-789"))
                .andExpect(status().isOk());
        assertThat(entrar(op.login(), "redefinida-789")).isNotBlank();

        // a própria senha só pela tela Configurações; a do administrador principal, só ele
        enviar(patch("/usuarios/" + g.id() + "/senha"), g, Map.of("senha", "redefinida-789"))
                .andExpect(status().isConflict());
        Integer adminId = jdbc.queryForObject("select id from usuario where login = 'capibaribe.admin'", Integer.class);
        enviar(patch("/usuarios/" + adminId + "/senha"), g, Map.of("senha", "redefinida-789"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("OPERACAO_NAO_PERMITIDA"));
        // operador não redefine senha de ninguém
        enviar(patch("/usuarios/" + g.id() + "/senha"), op, Map.of("senha", "redefinida-789"))
                .andExpect(status().isForbidden());

        // Auditoria (issue #16): só a redefinição que deu certo fica registrada, com gestor, afetado e hora.
        assertThat(auditoriaDe(op.id())).containsExactly("REDEFINICAO_SENHA por " + g.id());
        assertThat(auditoriaDe(g.id())).isEmpty();
        assertThat(jdbc.queryForObject(
                "select data_hora > now() - interval '1 minute' from auditoria_usuario where usuario_afetado_id = ?",
                Boolean.class, op.id())).isTrue();
    }

    @Test
    void desativarEReativarFicamNaAuditoriaQueNaoPodeSerAlteradaNemApagada() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        enviar(patch("/usuarios/" + op.id() + "/ativo"), g, Map.of("ativo", false)).andExpect(status().isOk());
        enviar(patch("/usuarios/" + op.id() + "/ativo"), g, Map.of("ativo", true)).andExpect(status().isOk());
        assertThat(auditoriaDe(op.id()))
                .containsExactly("DESATIVACAO_USUARIO por " + g.id(), "REATIVACAO_USUARIO por " + g.id());

        // A tabela não tem nenhuma coluna para senha ou hash.
        assertThat(jdbc.queryForList(
                "select column_name from information_schema.columns where table_name = 'auditoria_usuario'", String.class))
                .containsExactlyInAnyOrder("id", "gestor_id", "usuario_afetado_id", "acao", "data_hora");

        Integer id = jdbc.queryForObject("select max(id) from auditoria_usuario where usuario_afetado_id = ?", Integer.class, op.id());
        assertThatThrownBy(() -> jdbc.update("update auditoria_usuario set acao = 'REDEFINICAO_SENHA' where id = ?", id))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("delete from auditoria_usuario where id = ?", id))
                .isInstanceOf(DataAccessException.class);
    }

    /** Ações registradas sobre um usuário, em ordem, no formato "ACAO por gestorId". */
    private List<String> auditoriaDe(int usuarioId) {
        return jdbc.queryForList(
                "select acao || ' por ' || gestor_id from auditoria_usuario where usuario_afetado_id = ? order by id",
                String.class, usuarioId);
    }

    @Test
    void processoDuplicadoSemDiferenciarMaiusculas() throws Exception {
        Conta g = conta("gestor");
        String nome = "Tingimento " + seq.incrementAndGet();
        enviar(post("/processos"), g, Map.of("nome", nome, "unidade", "lote", "meta", 1500)).andExpect(status().isCreated());
        enviar(post("/processos"), g, Map.of("nome", nome.toUpperCase(), "unidade", "lote", "meta", 1500))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PROCESSO_DUPLICADO"));
    }

    @Test
    void processoInexistenteNoLoteRetorna422() throws Exception {
        Conta op = conta("operador");
        enviar(post("/lotes"), op, Map.of("processoId", 999999, "pecas", 1, "litros", 10))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.processoId").exists());
    }

    @Test
    void resumoMensalUsaFusoDeRecife() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");
        // 01/09/2026 02:30 UTC = 31/08/2026 23:30 em Recife → agosto
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 80, '2026-09-01T02:30:00Z')", p, g.id());
        // 01/09/2026 03:30 UTC = 01/09/2026 00:30 em Recife → setembro
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 130, '2026-09-01T03:30:00Z')", p, g.id());

        JsonNode agosto = filtrar(ler(chamar(get("/relatorios/resumo?mes=8&ano=2026"), g).andExpect(status().isOk())), p);
        assertThat(agosto.get("lotes").asLong()).isEqualTo(1);
        assertThat(agosto.get("real").decimalValue()).isEqualByComparingTo("80");
        assertThat(agosto.get("esperado").decimalValue()).isEqualByComparingTo("100");

        JsonNode setembro = filtrar(ler(chamar(get("/relatorios/resumo?mes=9&ano=2026"), g)), p);
        assertThat(setembro.get("lotes").asLong()).isEqualTo(1);
        assertThat(setembro.get("real").decimalValue()).isEqualByComparingTo("130");
    }

    private static JsonNode filtrar(JsonNode lista, int processoId) {
        for (JsonNode n : lista) if (n.get("processoId").asInt() == processoId) return n;
        throw new AssertionError("Processo " + processoId + " ausente no resumo: " + lista);
    }
}
