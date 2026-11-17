package br.com.aguas.integracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.aguas.notificacao.AvisoDeAlerta;
import br.com.aguas.notificacao.ReenvioDeAvisos;
import br.com.aguas.notificacao.Telegram;
import br.com.aguas.notificacao.TelegramProperties;
import br.com.aguas.repository.AlertaLoteRepository;
import br.com.aguas.repository.AlertaRepository;
import br.com.aguas.repository.AvisoPendenteRepository;
import br.com.aguas.repository.ProcessoRepository;
import br.com.aguas.service.Privacidade;

/**
 * Testes de integração contra um PostgreSQL com o esquema criado pelas migrações do Flyway.
 * Nunca usam o banco real: as subclasses só aceitam um contêiner descartável
 * (IntegracaoPostgresContainerTest) ou um banco local cujo nome termina em "_teste"
 * (IntegracaoPostgresLocalTest).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        // O teste sempre cria o esquema, mesmo com FLYWAY_ATIVO=false no backend/.env da máquina.
        "spring.flyway.enabled=true",
        "app.limite.login-por-minuto=100000",
        "app.limite.lotes-por-minuto=100000",
        "app.jwt.segredo=segredo-de-teste-com-mais-de-32-caracteres",
        "app.cors-origens=http://localhost:8443",
        "app.admin.senha=" + IntegracaoPostgresBase.SENHA_ADMIN })
abstract class IntegracaoPostgresBase {

    static final String SENHA_ADMIN = "admin-de-teste-123";

    @DynamicPropertySource
    static void telegramFalso(DynamicPropertyRegistry r) {
        r.add("app.telegram.url", TelegramFalso::url);
        r.add("app.telegram.token", () -> TelegramFalso.TOKEN);
        r.add("app.telegram.chat-id", () -> "123");
        // Pausa curta entre as tentativas do aviso, para os testes não esperarem os 2 segundos de verdade.
        r.add("app.telegram.espera-entre-tentativas", () -> "50ms");
        // A rotina de reenvio só roda quando o teste chama: o agendamento automático fica para daqui a 1 hora.
        r.add("app.telegram.reenvio-a-cada", () -> "1h");
    }

    private static final String SENHA = "senha-de-teste-123";

    /** Começa num valor da hora atual: logins e nomes não se repetem entre rodadas no mesmo banco de teste. */
    static final AtomicInteger seq = new AtomicInteger((int) (System.currentTimeMillis() / 1000 % 1_000_000) * 1000);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;
    @Autowired Flyway flyway;
    @Autowired ReenvioDeAvisos reenvio;
    @Autowired ApplicationContext contexto;

    record Conta(int id, String login, String token) {}

    // ---------- auxiliares ----------

    private Conta conta(String perfil) throws Exception {
        String login = perfil + ".t" + seq.incrementAndGet();
        Integer id = jdbc.queryForObject(
                "insert into usuario (nome, login, senha_hash, perfil) values (?, ?, ?, ?) returning id",
                Integer.class, "Pessoa " + login, login, encoder.encode(SENHA), perfil);
        return new Conta(id, login, entrar(login, SENHA));
    }

    String entrar(String login, String senha) throws Exception {
        String corpo = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("usuario", login, "senha", senha))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("token").asText();
    }

    ResultActions chamar(MockHttpServletRequestBuilder req, Conta c) throws Exception {
        return mvc.perform(req.header(HttpHeaders.AUTHORIZATION, "Bearer " + c.token()));
    }

    ResultActions enviar(MockHttpServletRequestBuilder req, Conta c, Object corpo) throws Exception {
        return chamar(req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)), c);
    }

    JsonNode ler(ResultActions r) throws Exception {
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

    List<JsonNode> alertasDo(Conta gestor, int processoId) throws Exception {
        List<JsonNode> r = new ArrayList<>();
        ler(chamar(get("/alertas"), gestor).andExpect(status().isOk()))
                .forEach(a -> { if (a.get("processoId").asInt() == processoId) r.add(a); });
        return r;
    }

    static List<Integer> ids(JsonNode arr) {
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
    void flywayAplicouTodasAsMigracoesEmOrdem() {
        // Pelo Flyway (usuário dono do esquema): o aguas_api não lê flyway_schema_history.
        var aplicadas = flyway.info().applied();
           assertThat(aplicadas).extracting(m -> m.getVersion().getVersion()).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13");
        assertThat(aplicadas).allMatch(m -> m.getState() == MigrationState.SUCCESS);
        assertThat(flyway.info().pending()).isEmpty();

        List<String> iniciais = jdbc.queryForList(
                "select nome from processo where nome in ('Amaciamento', 'Estonagem', 'Tingimento', 'Alvejamento')",
                String.class);
        assertThat(iniciais).containsExactlyInAnyOrder("Amaciamento", "Estonagem", "Tingimento", "Alvejamento");
    }

    @Test
    void reinicioValidaChecksumsENaoRecriaNada() {
        // Mesmo efeito de a API subir de novo num banco já migrado.
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
           assertThat(flyway.info().applied()).hasSize(13);
    }

    @Test
    void v8CriaIndicesDaRegraDeAlertaEDosLotesDoAlerta() {
        // Issue #59: medição em docs/tecnico/desempenho-indices.md.
        List<String> indices = jdbc.queryForList(
                "select indexname from pg_indexes where schemaname = 'public' and tablename in ('lote', 'alerta_lote')",
                String.class);
        assertThat(indices).contains("ix_lote_processo_data", "ix_alerta_lote_alerta", "ix_lote_data", "ix_lote_usuario")
                // substituído pelo ix_lote_processo_data, que começa pela mesma coluna
                .doesNotContain("ix_lote_processo");
    }

    @Test
    void v12CriaEfluentesDescarteComRegrasDeIntegridade() throws Exception {
        // Issue #162: auditoria do descarte de efluentes por lote (CPRH / ISO 14001).
        Conta g = conta("gestor");
        int loteId = lote(g, processo(g, "lote", "100"), 1, "90").get("id").asInt();
        String sql = "insert into efluentes_descarte (lote_id, volume_litros, ph, turbidez_ntu, reutilizado_percentual) "
                + "values (?, ?, ?, ?, ?)";

        jdbc.update(sql, loteId, new BigDecimal("85.50"), new BigDecimal("7.20"), new BigDecimal("12.0"), new BigDecimal("40"));
        assertThat(jdbc.queryForObject("select count(*) from efluentes_descarte where lote_id = ?", Integer.class, loteId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select data_descarte > now() - interval '1 minute' from efluentes_descarte "
                + "where lote_id = ?", Boolean.class, loteId)).isTrue();

        // pH fora de 0 a 14, volume zero, turbidez negativa, reaproveitamento acima de 100% e lote inexistente.
        assertThatThrownBy(() -> jdbc.update(sql, loteId, BigDecimal.TEN, new BigDecimal("14.01"), BigDecimal.ONE, BigDecimal.ZERO))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql, loteId, BigDecimal.TEN, new BigDecimal("-0.01"), BigDecimal.ONE, BigDecimal.ZERO))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql, loteId, BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ZERO))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql, loteId, BigDecimal.TEN, BigDecimal.TEN, new BigDecimal("-1"), BigDecimal.ZERO))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql, loteId, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ONE, new BigDecimal("100.01")))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(sql, -1, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ZERO))
                .isInstanceOf(DataAccessException.class);

        List<String> indices = jdbc.queryForList(
                "select indexname from pg_indexes where schemaname = 'public' and tablename = 'efluentes_descarte'",
                String.class);
        assertThat(indices).contains("ix_efluentes_descarte_lote", "ix_efluentes_descarte_data");
    }

    @Test
    void v13DeixaOAutovacuumMaisFrequenteNasTabelasQuentes() {
        // Issue #163: rotina em docs/tecnico/manutencao-banco.md.
        Map<String, List<String>> opcoes = new HashMap<>();
        jdbc.query("select relname, array_to_string(reloptions, ',') as op from pg_class "
                + "where relnamespace = 'public'::regnamespace and relname in ('lote', 'alerta_lote', 'alerta')",
                rs -> { opcoes.put(rs.getString("relname"), List.of(rs.getString("op").split(","))); });
        List<String> soInsercao = List.of("autovacuum_vacuum_scale_factor=0.05", "autovacuum_vacuum_insert_scale_factor=0.05",
                "autovacuum_analyze_scale_factor=0.02");
        assertThat(opcoes.get("lote")).containsExactlyInAnyOrderElementsOf(soInsercao);
        assertThat(opcoes.get("alerta_lote")).containsExactlyInAnyOrderElementsOf(soInsercao);
        assertThat(opcoes.get("alerta")).containsExactlyInAnyOrder("autovacuum_vacuum_scale_factor=0.05",
                "autovacuum_analyze_scale_factor=0.02");
    }

    // ---------- monitoramento (issue #51) ----------

    @Test
    void saudeAbertaMostraSoOStatusSemToken() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
        // Operador e gestor também não veem os detalhes; o admin vê o banco.
        chamar(get("/actuator/health"), conta("gestor")).andExpect(jsonPath("$.components").doesNotExist());
        chamar(get("/actuator/health"), conta("admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.db.status").value("UP"));
    }

    @Test
    void metricasSoParaOAdmin() throws Exception {
        mvc.perform(get("/actuator/metrics")).andExpect(status().isUnauthorized());
        for (String perfil : List.of("operador", "gestor", "sensor")) {
            chamar(get("/actuator/metrics"), conta(perfil)).andExpect(status().isForbidden());
        }
        Conta adm = conta("admin");
        chamar(get("/processos"), adm).andExpect(status().isOk());
        chamar(get("/actuator/metrics"), adm)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.names").value(org.hamcrest.Matchers.hasItems(
                        "http.server.requests", "jvm.memory.used", "hikaricp.connections.active")));
        // Tempo de resposta de uma rota: quantas chamadas e o tempo total.
        chamar(get("/actuator/metrics/http.server.requests").param("tag", "uri:/processos"), adm)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measurements[?(@.statistic == 'COUNT')].value").isNotEmpty())
                .andExpect(jsonPath("$.measurements[?(@.statistic == 'TOTAL_TIME')].value").isNotEmpty());
    }

    @Test
    void outrosEndpointsDoActuatorFicamFechados() throws Exception {
        Conta adm = conta("admin");
        // env, beans, heapdump e afins mostrariam senhas e a memória da API: nem o admin acessa.
        for (String rota : List.of("/actuator", "/actuator/env", "/actuator/beans", "/actuator/heapdump",
                "/actuator/configprops", "/actuator/loggers", "/actuator/health/db")) {
            chamar(get(rota), adm).andExpect(status().isForbidden());
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
    void historicoFiltraPorQuemRegistrouSoParaGestor() throws Exception {
        Conta g = conta("gestor");
        Conta op1 = conta("operador");
        Conta op2 = conta("operador");
        int p = processo(g, "peca", "10");
        int doOp1 = lote(op1, p, 5, "40").get("id").asInt();
        int doOp2 = lote(op2, p, 5, "40").get("id").asInt();

        // Gestor: só os lotes da pessoa escolhida, combinando com o processo.
        List<Integer> doGestor = new ArrayList<>();
        ler(chamar(get("/lotes?processoId=" + p + "&usuarioId=" + op2.id()), g).andExpect(status().isOk()))
                .forEach(l -> doGestor.add(l.get("id").asInt()));
        assertThat(doGestor).containsExactly(doOp2);

        // Operador: o filtro de outra pessoa é ignorado; ele continua vendo só os próprios lotes.
        List<Integer> doOperador = new ArrayList<>();
        ler(chamar(get("/lotes?processoId=" + p + "&usuarioId=" + op2.id()), op1).andExpect(status().isOk()))
                .forEach(l -> doOperador.add(l.get("id").asInt()));
        assertThat(doOperador).containsExactly(doOp1);
    }

    @Test
    void usuarioDesativadoPerdeAcessoNaProximaRequisicao() throws Exception {
        Conta g = conta("admin");
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
                .isEqualTo("admin");
        assertThat(entrar("capibaribe.admin", SENHA_ADMIN)).isNotBlank();

        Integer adminId = jdbc.queryForObject("select id from usuario where login = 'capibaribe.admin'", Integer.class);
        Conta g = conta("admin");
        enviar(patch("/usuarios/" + adminId + "/ativo"), g, Map.of("ativo", false))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("OPERACAO_NAO_PERMITIDA"));
    }

    @Test
    void criarUsuarioEDuplicidade() throws Exception {
        Conta g = conta("admin");
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
    void administradorRedefineSenhaDeOutraPessoa() throws Exception {
        Conta g = conta("admin");
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
    void administradorRotacionaTokenDeApiERevogaOAnteriorNaHora() throws Exception {
        Conta adm = conta("admin");
        Conta sensor = conta("sensor");
        int p = processo(adm, "lote", "100");
        var corpoLote = Map.of("processoId", p, "pecas", 10, "litros", new BigDecimal("90"));

        // Given: administrador autenticado. When: aciona a rotação. Then: chave de 64 caracteres alfanuméricos.
        String primeira = ler(chamar(post("/usuarios/" + sensor.id() + "/token/rotacao"), adm).andExpect(status().isOk()))
                .get("token").asText();
        assertThat(primeira).matches("[A-Za-z0-9]{64}");
        // O sensor usa a chave direto, sem login, e só no que o perfil dele permite.
        mvc.perform(post("/lotes").header(HttpHeaders.AUTHORIZATION, "Bearer " + primeira)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpoLote)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuarioId").value(sensor.id()));
        mvc.perform(get("/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + primeira))
                .andExpect(status().isForbidden());

        // Nova rotação: outra chave, e a anterior para de valer já na requisição seguinte.
        String segunda = ler(chamar(post("/usuarios/" + sensor.id() + "/token/rotacao"), adm).andExpect(status().isOk()))
                .get("token").asText();
        assertThat(segunda).matches("[A-Za-z0-9]{64}").isNotEqualTo(primeira);
        mvc.perform(post("/lotes").header(HttpHeaders.AUTHORIZATION, "Bearer " + primeira)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpoLote)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + segunda)).andExpect(status().isOk());

        // No banco fica só o hash (SHA-256) da chave atual, nunca a chave.
        String hash = jdbc.queryForObject("select token_hash from usuario where id = ?", String.class, sensor.id());
        assertThat(hash).matches("[0-9a-f]{64}").isNotEqualTo(segunda);
        assertThat(jdbc.queryForObject("select count(*) from usuario where token_hash in (?, ?)", Integer.class, primeira, segunda))
                .isZero();

        // O próprio sensor não rotaciona o token dele.
        chamar(post("/usuarios/" + sensor.id() + "/token/rotacao"), sensor).andExpect(status().isForbidden());

        // Conta desativada perde o acesso também pelo token.
        enviar(patch("/usuarios/" + sensor.id() + "/ativo"), adm, Map.of("ativo", false)).andExpect(status().isOk());
        mvc.perform(get("/processos").header(HttpHeaders.AUTHORIZATION, "Bearer " + segunda)).andExpect(status().isUnauthorized());

        // Só administrador, só conta de sensor; o que foi recusado não entra na auditoria.
        Conta g = conta("gestor");
        Conta op = conta("operador");
        chamar(post("/usuarios/" + sensor.id() + "/token/rotacao"), g).andExpect(status().isForbidden());
        chamar(post("/usuarios/" + op.id() + "/token/rotacao"), adm).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("OPERACAO_NAO_PERMITIDA"));
        chamar(post("/usuarios/999999999/token/rotacao"), adm).andExpect(status().isNotFound());
        assertThat(auditoriaDe(sensor.id())).containsExactly("ROTACAO_TOKEN por " + adm.id(),
                "ROTACAO_TOKEN por " + adm.id(), "DESATIVACAO_USUARIO por " + adm.id());
        assertThat(auditoriaDe(op.id())).isEmpty();
    }

    @Test
    void desativarEReativarFicamNaAuditoriaQueNaoPodeSerAlteradaNemApagada() throws Exception {
        Conta g = conta("admin");
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

    @Test
    void auditoriaListaAsAcoesComFiltrosEPaginacao() throws Exception {
        Conta g = conta("admin");
        Conta op = conta("operador");
        String login = "auditado.t" + seq.incrementAndGet();
        int criado = ler(enviar(post("/usuarios"), g, Map.of("nome", "Pessoa Auditada", "usuario", login, "perfil", "operador", "senha", SENHA))
                .andExpect(status().isCreated())).get("id").asInt();
        enviar(patch("/usuarios/" + criado + "/ativo"), g, Map.of("ativo", false)).andExpect(status().isOk());
        assertThat(auditoriaDe(criado)).containsExactly("CRIACAO_USUARIO por " + g.id(), "DESATIVACAO_USUARIO por " + g.id());

        JsonNode pagina = ler(chamar(get("/auditoria").param("tamanho", "100"), g).andExpect(status().isOk()));
        List<JsonNode> doCriado = new ArrayList<>();
        pagina.get("itens").forEach(r -> { if (r.get("usuarioAfetado").get("id").asInt() == criado) doCriado.add(r); });
        assertThat(doCriado).extracting(r -> r.get("acao").asText()).containsExactly("DESATIVACAO_USUARIO", "CRIACAO_USUARIO");
        // LGPD (RNF27): nome inteiro, login mascarado.
        assertThat(doCriado.getFirst().get("gestor").get("usuario").asText()).isEqualTo(Privacidade.mascararLogin(g.login()));
        assertThat(doCriado.getFirst().get("usuarioAfetado").get("nome").asText()).isEqualTo("Pessoa Auditada");
        assertThat(doCriado.getFirst().get("usuarioAfetado").get("usuario").asText()).isEqualTo(Privacidade.mascararLogin(login));
        assertThat(doCriado.getFirst().toString()).doesNotContain("senha", "hash", login);

        // Lista de usuários: o administrador vê o login inteiro; o gestor, só o próprio.
        Conta gestor = conta("gestor");
        assertThat(loginNaLista(g, criado)).isEqualTo(login);
        assertThat(loginNaLista(gestor, criado)).isEqualTo(Privacidade.mascararLogin(login));
        assertThat(loginNaLista(gestor, gestor.id())).isEqualTo(gestor.login());

        JsonNode porAcao = ler(chamar(get("/auditoria").param("acao", "CRIACAO_USUARIO").param("tamanho", "100"), g).andExpect(status().isOk()));
        porAcao.get("itens").forEach(r -> assertThat(r.get("acao").asText()).isEqualTo("CRIACAO_USUARIO"));

        JsonNode umPorPagina = ler(chamar(get("/auditoria").param("tamanho", "1"), g).andExpect(status().isOk()));
        assertThat(umPorPagina.get("itens")).hasSize(1);
        assertThat(umPorPagina.get("total").asLong()).isGreaterThanOrEqualTo(2);

        JsonNode noFuturo = ler(chamar(get("/auditoria").param("inicio", "2999-01-01T00:00:00-03:00"), g).andExpect(status().isOk()));
        assertThat(noFuturo.get("total").asLong()).isZero();

        chamar(get("/auditoria"), op).andExpect(status().isForbidden());
        chamar(get("/auditoria").param("tamanho", "101"), g).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/auditoria")).andExpect(status().isUnauthorized());
    }

    /** Login de um usuário como aparece em GET /usuarios para quem pergunta. */
    private String loginNaLista(Conta quem, int usuarioId) throws Exception {
        JsonNode lista = ler(chamar(get("/usuarios"), quem).andExpect(status().isOk()));
        for (JsonNode u : lista) if (u.get("id").asInt() == usuarioId) return u.get("usuario").asText();
        throw new AssertionError("Usuário " + usuarioId + " fora da lista.");
    }

    /** Ações registradas sobre um usuário, em ordem, no formato "ACAO por gestorId". */
    private List<String> auditoriaDe(int usuarioId) {
        return jdbc.queryForList(
                "select acao || ' por ' || gestor_id from auditoria_usuario where usuario_afetado_id = ? order by id",
                String.class, usuarioId);
    }

    @Test
    void cadaPerfilAcessaSoOQueLheCabe() throws Exception {
        Conta adm = conta("admin");
        Conta g = conta("gestor");
        Conta op = conta("operador");
        Conta s = conta("sensor");
        var novo = Map.of("nome", "Nova Pessoa", "usuario", "nova.t" + seq.incrementAndGet(), "perfil", "operador", "senha", SENHA);

        // Administrador: usuários e auditoria, além do que o gestor faz
        chamar(get("/auditoria"), adm).andExpect(status().isOk());
        chamar(get("/alertas"), adm).andExpect(status().isOk());
        int processo = processo(adm, "lote", "800");

        // Gestor: acompanha a operação e só lê a lista de usuários
        chamar(get("/usuarios"), g).andExpect(status().isOk());
        chamar(get("/alertas"), g).andExpect(status().isOk());
        processo(g, "lote", "800");
        chamar(get("/auditoria"), g).andExpect(status().isForbidden());
        enviar(post("/usuarios"), g, novo).andExpect(status().isForbidden());
        enviar(patch("/usuarios/" + op.id() + "/ativo"), g, Map.of("ativo", false)).andExpect(status().isForbidden());
        enviar(patch("/usuarios/" + op.id() + "/senha"), g, Map.of("senha", "redefinida-789")).andExpect(status().isForbidden());

        // Operador: só o que já tinha
        chamar(get("/lotes"), op).andExpect(status().isOk());
        chamar(get("/auth/me"), op).andExpect(status().isOk());
        chamar(get("/usuarios"), op).andExpect(status().isForbidden());
        chamar(get("/auditoria"), op).andExpect(status().isForbidden());

        // Sensor: consulta os processos e registra lotes, e mais nada
        chamar(get("/processos"), s).andExpect(status().isOk());
        assertThat(lote(s, processo, 100, "790").get("usuarioId").asInt()).isEqualTo(s.id());
        chamar(get("/lotes"), s).andExpect(status().isForbidden());
        chamar(get("/auth/me"), s).andExpect(status().isForbidden());
        chamar(get("/alertas"), s).andExpect(status().isForbidden());
        chamar(get("/usuarios"), s).andExpect(status().isForbidden());
        enviar(patch("/usuarios/" + s.id()), s, Map.of("senha", "outra-senha-456", "senhaAtual", SENHA)).andExpect(status().isForbidden());
    }

    @Test
    void alertaAbertoAvisaNoTelegramDepoisDeGravar() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "800");
        String nome = jdbc.queryForObject("select nome from processo where id = ?", String.class, p);
        lote(g, p, 10, "900");
        lote(g, p, 10, "900");
        lote(g, p, 10, "900");
        int alerta = alertasDo(g, p).getFirst().get("id").asInt();

        TelegramFalso.Pedido aviso = esperarAviso(nome);
        assertThat(aviso.caminho()).isEqualTo("/bot" + TelegramFalso.TOKEN + "/sendMessage");
        assertThat(aviso.corpo()).contains("\"chat_id\":\"123\"", "Alerta #" + alerta);
        // Envio que deu certo não fica pendente.
        assertThat(jdbc.queryForObject("select count(*) from aviso_pendente where alerta_id = ?", Integer.class, alerta)).isZero();
    }

    @Test
    void telegramForaDoArNaoAtrapalhaORegistroDoLoteEOAvisoFicaPendente() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "800");
        String nome = jdbc.queryForObject("select nome from processo where id = ?", String.class, p);
        TelegramFalso.status = 500;
        try {
            // Given: lotes com consumo acima da meta abrem o alerta. When: o Telegram falha em todo envio.
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            int alerta = alertasDo(g, p).getFirst().get("id").asInt();

            // Then: 3 tentativas e o aviso gravado como pendente, com o status HTTP e sem o token.
            Map<String, Object> pendente = esperarPendente(alerta);
            assertThat(pendente.get("tentativas")).isEqualTo(3);
            assertThat(pendente.get("ultimo_erro")).isEqualTo("HTTP 500");
            assertThat(TelegramFalso.pedidos.stream().filter(x -> x.corpo().contains(nome))).hasSize(3);
            assertThat(jdbc.queryForObject("select criado_em > now() - interval '1 minute' from aviso_pendente where alerta_id = ?",
                    Boolean.class, alerta)).isTrue();
        } finally {
            TelegramFalso.status = 200;
        }
        // O lote e o alerta continuam gravados.
        assertThat(alertasDo(g, p)).hasSize(1);
        assertThat(jdbc.queryForObject("select count(*) from lote where processo_id = ?", Integer.class, p)).isEqualTo(3);
    }

    @Test
    void telegramVoltaEARotinaReenviaOAvisoPendenteUmaVezSo() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "800");
        int alerta;
        TelegramFalso.status = 500;
        try {
            // Given: o Telegram fora do ar quando o alerta abre; o aviso fica pendente.
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            alerta = alertasDo(g, p).getFirst().get("id").asInt();
            esperarPendente(alerta);
        } finally {
            TelegramFalso.status = 200;
        }

        // When: o Telegram volta e a rotina roda.
        reenvio.reenviarPendentes();

        // Then: o aviso atrasado chega e fica marcado como enviado, com a tentativa contada.
        List<TelegramFalso.Pedido> atrasados = avisosAtrasados(alerta);
        assertThat(atrasados).hasSize(1);
        assertThat(atrasados.getFirst().corpo()).contains("Aviso atrasado");
        Map<String, Object> linha = jdbc.queryForMap(
                "select tentativas, enviado_em > now() - interval '1 minute' as recente from aviso_pendente where alerta_id = ?", alerta);
        assertThat(linha.get("tentativas")).isEqualTo(4);
        assertThat(linha.get("recente")).isEqualTo(true);

        // A próxima rodada não manda de novo o que já chegou.
        reenvio.reenviarPendentes();
        assertThat(avisosAtrasados(alerta)).hasSize(1);
    }

    @Test
    void avisoPendenteAlemDoLimiteOuDeAlertaJaTratadoNaoEReenviado() throws Exception {
        Conta g = conta("gestor");

        // Passou do limite: uma rotina com limite de 1 ms já vê o aviso como vencido. Assim o teste não precisa
        // mudar criado_em, que o aguas_api não pode atualizar (V11), e roda com qualquer usuário do banco.
        int antigo = alertaComAvisoPendente(g);
        TelegramProperties p = contexto.getBean(TelegramProperties.class);
        var limiteCurto = new TelegramProperties(p.token(), p.chatId(), p.url(), p.siteUrl(), p.esperaEntreTentativas(),
                p.reenvioACada(), Duration.ofMillis(1));
        Thread.sleep(5);
        new ReenvioDeAvisos(contexto.getBean(Telegram.class), limiteCurto, contexto.getBean(AvisoDeAlerta.class),
                contexto.getBean(AvisoPendenteRepository.class), contexto.getBean(AlertaRepository.class),
                contexto.getBean(ProcessoRepository.class), contexto.getBean(AlertaLoteRepository.class))
                .reenviarPendentes();
        assertThat(avisosAtrasados(antigo)).isEmpty();

        // Alerta que o gestor já pôs em análise: a rotina normal não manda o aviso atrasado.
        int tratado = alertaComAvisoPendente(g);
        enviar(patch("/alertas/" + tratado + "/status"), g, Map.of("status", "analise")).andExpect(status().isOk());
        reenvio.reenviarPendentes();
        assertThat(avisosAtrasados(tratado)).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from aviso_pendente where alerta_id = ? and enviado_em is null",
                Integer.class, tratado)).isOne();
    }

    /** Abre um alerta com o Telegram fora do ar e espera o aviso ficar pendente. */
    private int alertaComAvisoPendente(Conta g) throws Exception {
        int p = processo(g, "lote", "800");
        TelegramFalso.status = 500;
        try {
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            lote(g, p, 10, "900");
            int alerta = alertasDo(g, p).getFirst().get("id").asInt();
            esperarPendente(alerta);
            return alerta;
        } finally {
            TelegramFalso.status = 200;
        }
    }

    private static List<TelegramFalso.Pedido> avisosAtrasados(int alertaId) {
        return TelegramFalso.pedidos.stream()
                .filter(x -> x.corpo().contains("Aviso atrasado") && x.corpo().contains("Alerta #" + alertaId + " aberto"))
                .toList();
    }

    /** As tentativas saem em outra thread: espera até 10 s pelo registro do aviso pendente do alerta. */
    private Map<String, Object> esperarPendente(int alertaId) throws InterruptedException {
        for (int i = 0; i < 100; i++) {
            List<Map<String, Object>> linhas = jdbc.queryForList(
                    "select tentativas, ultimo_erro from aviso_pendente where alerta_id = ?", alertaId);
            if (!linhas.isEmpty()) return linhas.getFirst();
            Thread.sleep(100);
        }
        throw new AssertionError("O aviso do alerta " + alertaId + " não foi gravado como pendente");
    }

    /** O aviso sai em outra thread, depois do commit: espera até 5 s pela mensagem do processo. */
    private static TelegramFalso.Pedido esperarAviso(String processo) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            for (TelegramFalso.Pedido pedido : TelegramFalso.pedidos) {
                if (pedido.corpo().contains(processo)) return pedido;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("O Telegram não recebeu o aviso do processo " + processo);
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
    void reenvioComAMesmaChaveNaoDuplicaOLote() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        int p = processo(g, "lote", "100");
        String chave = UUID.randomUUID().toString();
        var corpo = Map.of("processoId", p, "pecas", 10, "litros", new BigDecimal("150"));

        // 1º envio grava; o 2º e o 3º simulam a resposta perdida na Wi-Fi e o site tentando de novo.
        JsonNode primeiro = ler(enviar(post("/lotes").header("Idempotency-Key", chave), op, corpo).andExpect(status().isCreated()));
        JsonNode segundo = ler(enviar(post("/lotes").header("Idempotency-Key", chave), op, corpo).andExpect(status().isOk()));
        enviar(post("/lotes").header("Idempotency-Key", chave), op, corpo).andExpect(status().isOk());

        assertThat(segundo.get("id").asInt()).isEqualTo(primeiro.get("id").asInt());
        assertThat(segundo.get("data").asText()).isEqualTo(primeiro.get("data").asText());
        assertThat(jdbc.queryForObject("select count(*) from lote where chave_envio = ?::uuid", Integer.class, chave)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from lote where processo_id = ?", Integer.class, p)).isEqualTo(1);

        // O reenvio não conta como novo lote acima da meta: 1 lote real não abre alerta.
        assertThat(alertasDo(g, p)).isEmpty();

        // Sem chave (sensor ESP32), cada envio continua sendo um lote novo.
        lote(op, p, 10, "150");
        lote(op, p, 10, "150");
        assertThat(jdbc.queryForObject("select count(*) from lote where processo_id = ?", Integer.class, p)).isEqualTo(3);
    }

    @Test
    void chaveDeEnvioReaproveitadaComOutrosDadosOuOutroUsuarioRetorna409() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        Conta outro = conta("operador");
        int p = processo(g, "lote", "100");
        String chave = UUID.randomUUID().toString();
        enviar(post("/lotes").header("Idempotency-Key", chave), op, Map.of("processoId", p, "pecas", 1, "litros", 90))
                .andExpect(status().isCreated());

        enviar(post("/lotes").header("Idempotency-Key", chave), op, Map.of("processoId", p, "pecas", 1, "litros", 91))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CHAVE_DE_ENVIO_REPETIDA"));
        enviar(post("/lotes").header("Idempotency-Key", chave), outro, Map.of("processoId", p, "pecas", 1, "litros", 90))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CHAVE_DE_ENVIO_REPETIDA"));
        enviar(post("/lotes").header("Idempotency-Key", "nao-e-uuid"), op, Map.of("processoId", p, "pecas", 1, "litros", 90))
                .andExpect(status().isBadRequest());

        assertThat(jdbc.queryForObject("select count(*) from lote where processo_id = ?", Integer.class, p)).isEqualTo(1);
    }

    @Test
    void bancoRecusaChaveDeEnvioDuplicadaMesmoSemPassarPelaApi() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");
        String chave = UUID.randomUUID().toString();
        String sql = "insert into lote (processo_id, usuario_id, pecas, litros, chave_envio) values (?, ?, 1, 10, ?::uuid)";
        jdbc.update(sql, p, g.id(), chave);
        assertThatThrownBy(() -> jdbc.update(sql, p, g.id(), chave)).isInstanceOf(DataAccessException.class);
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
        // Pegada hídrica (#116): 1 peça com 80 L = 80 L por peça.
        assertThat(agosto.get("pecas").asLong()).isEqualTo(1);
        assertThat(agosto.get("litrosPorPeca").decimalValue()).isEqualByComparingTo("80");

        JsonNode setembro = filtrar(ler(chamar(get("/relatorios/resumo?mes=9&ano=2026"), g)), p);
        assertThat(setembro.get("lotes").asLong()).isEqualTo(1);
        assertThat(setembro.get("real").decimalValue()).isEqualByComparingTo("130");
    }

    /** Baixa o CSV (resposta em streaming: precisa do asyncDispatch) e devolve o texto, com o BOM. */
    String baixarCsv(String query, Conta c) throws Exception {
        MvcResult inicio = chamar(get("/relatorios/csv?" + query), c)
                .andExpect(request().asyncStarted()).andReturn();
        MockHttpServletResponse resp = mvc.perform(asyncDispatch(inicio))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "text/csv;charset=UTF-8"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andReturn().getResponse();
        return new String(resp.getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    @Test
    void csvDoPeriodoUsaFusoDeRecifeFiltraPorProcessoEProtegeTextos() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "lote", "100");
        int outro = processo(g, "lote", "100");
        jdbc.update("update processo set nome = ? where id = ?", "=Estonagem; teste", p);
        // 31/08/2026 23:30 em Recife: fora de setembro
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 80, '2026-09-01T02:30:00Z')", p, g.id());
        // 01/09/2026 00:30 em Recife
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 10, 108, '2026-09-01T03:30:00Z')", p, g.id());
        // 30/09/2026 23:59:59 em Recife: último segundo do período
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 90, '2026-10-01T02:59:59Z')", p, g.id());
        // 01/10/2026 00:00 em Recife: fora
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 90, '2026-10-01T03:00:00Z')", p, g.id());
        jdbc.update("insert into lote (processo_id, usuario_id, pecas, litros, registrado_em) values (?, ?, 1, 90, '2026-09-15T12:00:00Z')", outro, g.id());

        String csv = baixarCsv("inicio=2026-09-01&fim=2026-09-30&processoId=" + p, g);
        assertThat(csv).startsWith("\uFEFFID do lote;Data;Hora;");
        String[] linhas = csv.substring(1).split("\r\n");
        assertThat(linhas).hasSize(3);
        assertThat(linhas[1]).matches("\\d+;01/09/2026;00:30:00;2026-09-01T03:30:00Z;\"'=Estonagem; teste\";10;"
                + "108,00;100,00;8,00;8,00;Atenção;Pessoa " + g.login());
        assertThat(linhas[2]).contains(";30/09/2026;23:59:59;").endsWith(";Dentro da meta;Pessoa " + g.login());

        // Sem o filtro de processo, entra o lote do outro processo, em ordem de registro
        String[] todos = baixarCsv("inicio=2026-09-01&fim=2026-09-30", g).split("\r\n");
        assertThat(java.util.Arrays.stream(todos).filter(l -> l.contains(";15/09/2026;")).count()).isEqualTo(1);
    }

    @Test
    void csvComMilharesDeLotesNaMesmaHoraNaoRepeteNemPulaNenhum() throws Exception {
        Conta g = conta("gestor");
        int p = processo(g, "peca", "50");
        // 50.000 lotes (o volume da issue #99), todos no mesmo instante: o desempate pelo id é que separa as páginas
        jdbc.update("""
                insert into lote (processo_id, usuario_id, pecas, litros, registrado_em)
                select ?, ?, 2, 100, '2025-03-10T15:00:00Z' from generate_series(1, 50000)
                """, p, g.id());
        List<Integer> ids = jdbc.queryForList("select id from lote where processo_id = ? order by id", Integer.class, p);

        String[] linhas = baixarCsv("inicio=2025-03-10&fim=2025-03-10&processoId=" + p, g).split("\r\n");
        assertThat(linhas).hasSize(50_001);
        List<Integer> doCsv = java.util.Arrays.stream(linhas).skip(1)
                .map(l -> Integer.valueOf(l.substring(0, l.indexOf(';')))).toList();
        assertThat(doCsv).isEqualTo(ids);
    }

    @Test
    void csvConfereOPeriodoEOProcessoAntesDeComecarESoParaGestor() throws Exception {
        Conta g = conta("gestor");
        Conta op = conta("operador");
        chamar(get("/relatorios/csv?inicio=2026-09-30&fim=2026-09-01"), g)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.fim").exists());
        chamar(get("/relatorios/csv?inicio=2026-01-01&fim=2027-01-01"), g)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.fim").value("Escolha um período de até 1 ano."));
        chamar(get("/relatorios/csv?inicio=2026-01-01&fim=2026-12-31&processoId=999999"), g)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.campos.processoId").exists());
        chamar(get("/relatorios/csv?inicio=2026-01-01&fim=2026-12-31"), op).andExpect(status().isForbidden());

        // O ano inteiro cabe, e o nome do arquivo diz o período
        MvcResult r = chamar(get("/relatorios/csv?inicio=2026-01-01&fim=2026-12-31"), g)
                .andExpect(request().asyncStarted()).andReturn();
        mvc.perform(asyncDispatch(r)).andExpect(status().isOk()).andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"aguas-do-capibaribe-lotes-2026-01-01-a-2026-12-31.csv\""));
    }

    static JsonNode filtrar(JsonNode lista, int processoId) {
        for (JsonNode n : lista) if (n.get("processoId").asInt() == processoId) return n;
        throw new AssertionError("Processo " + processoId + " ausente no resumo: " + lista);
    }
}
