package br.com.aguas.integracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Aceitação do ciclo hídrico (issue #12): a jornada de uma lavanderia, do login ao relatório do mês, só
 * por chamadas HTTP e em sequência, como o site e o sensor fazem. Abstrata porque quem escolhe o banco
 * são as subclasses: roda no contêiner (IntegracaoPostgresContainerTest) ou no banco local
 * (IntegracaoPostgresLocalTest), junto com os demais testes de integração.
 */
abstract class CicloCompletoLavanderiaE2ETest extends IntegracaoPostgresBase {

    private static final int PECAS = 100;
    private static final String SENHA_OPERADOR = "senha-do-operador-123";

    @Test
    void jornadaCompletaDoLoginAoRelatorio() throws Exception {
        // 1. Gestor entra com o administrador criado pela API
        String tokenGestor = entrar("capibaribe.admin", SENHA_ADMIN);
        Conta gestor = new Conta(0, "capibaribe.admin", tokenGestor);
        chamar(get("/auth/me"), gestor).andExpect(status().isOk());

        // 2. Gestor cadastra o processo com meta de 15 L/peça
        var novoProcesso = Map.of("nome", "Tingimento Reativo " + seq.incrementAndGet(), "unidade", "peca",
                "meta", new BigDecimal("15.0"));
        int processo = ler(enviar(post("/processos"), gestor, novoProcesso).andExpect(status().isCreated())).get("id").asInt();

        // 3. Gestor cadastra o operador, que já nasce ativo
        String login = "operador.ciclo" + seq.incrementAndGet();
        var novoOperador = Map.of("nome", "Operador do Ciclo", "usuario", login, "perfil", "operador", "senha", SENHA_OPERADOR);
        JsonNode cadastrado = ler(enviar(post("/usuarios"), gestor, novoOperador).andExpect(status().isCreated()));
        assertThat(cadastrado.get("ativo").asBoolean()).isTrue();

        // 4. Operador entra com as próprias credenciais
        Conta operador = new Conta(cadastrado.get("id").asInt(), login, entrar(login, SENHA_OPERADOR));

        // 5. Dois lotes dentro da meta aparecem no histórico e não abrem alerta
        int normal1 = registrar(operador, processo, "1400", "DENTRO_DA_META");
        int normal2 = registrar(operador, processo, "1500", "DENTRO_DA_META");
        List<Integer> historico = new ArrayList<>();
        ler(chamar(get("/lotes?processoId=" + processo), operador).andExpect(status().isOk()))
                .forEach(l -> historico.add(l.get("id").asInt()));
        assertThat(historico).containsExactly(normal2, normal1);
        assertThat(alertasDo(gestor, processo)).isEmpty();

        // 6. Dois lotes a 25 L/peça ainda não bastam; o terceiro seguido abre o alerta
        int excesso1 = registrar(operador, processo, "2500", "CRITICO");
        int excesso2 = registrar(operador, processo, "2500", "CRITICO");
        assertThat(alertasDo(gestor, processo)).isEmpty();
        int excesso3 = registrar(operador, processo, "2500", "CRITICO");

        // 7. Alerta aberto com os 3 lotes
        List<JsonNode> alertas = alertasDo(gestor, processo);
        assertThat(alertas).hasSize(1);
        int alerta = alertas.get(0).get("id").asInt();
        assertThat(alertas.get(0).get("status").asText()).isEqualTo("aberto");
        assertThat(ids(alertas.get(0).get("loteIds"))).containsExactly(excesso1, excesso2, excesso3);

        // 8. O 4º lote seguido entra no alerta aberto, sem criar outro
        int excesso4 = registrar(operador, processo, "2500", "CRITICO");
        alertas = alertasDo(gestor, processo);
        assertThat(alertas).hasSize(1);
        assertThat(ids(alertas.get(0).get("loteIds"))).containsExactly(excesso1, excesso2, excesso3, excesso4);

        // 9. Só o gestor trata o alerta: aberto → em análise → resolvido
        enviar(patch("/alertas/" + alerta + "/status"), operador, Map.of("status", "analise")).andExpect(status().isForbidden());
        for (String novo : List.of("analise", "resolvido")) {
            JsonNode atualizado = ler(enviar(patch("/alertas/" + alerta + "/status"), gestor, Map.of("status", novo)).andExpect(status().isOk()));
            assertThat(atualizado.get("status").asText()).isEqualTo(novo);
        }

        // 10. O relatório do mês soma exatamente os 6 lotes: 1400 + 1500 + 4 x 2500 e 6 x 1500 esperados
        YearMonth mes = YearMonth.now(ZoneId.of("America/Recife"));
        JsonNode resumo = filtrar(ler(chamar(get("/relatorios/resumo?mes=" + mes.getMonthValue() + "&ano=" + mes.getYear()), gestor)
                .andExpect(status().isOk())), processo);
        assertThat(resumo.get("lotes").asLong()).isEqualTo(6);
        assertThat(resumo.get("real").decimalValue()).isEqualByComparingTo("12900");
        assertThat(resumo.get("esperado").decimalValue()).isEqualByComparingTo("9000");
    }

    private int registrar(Conta quem, int processo, String litros, String statusEsperado) throws Exception {
        var corpo = Map.of("processoId", processo, "pecas", PECAS, "litros", new BigDecimal(litros));
        JsonNode lote = ler(enviar(post("/lotes"), quem, corpo).andExpect(status().isCreated()));
        assertThat(lote.get("esperado").decimalValue()).isEqualByComparingTo("1500");
        assertThat(lote.get("statusConformidade").asText()).isEqualTo(statusEsperado);
        return lote.get("id").asInt();
    }
}
