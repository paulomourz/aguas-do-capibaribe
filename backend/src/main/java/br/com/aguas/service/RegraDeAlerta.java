package br.com.aguas.service;

import java.util.List;

import br.com.aguas.entity.StatusAlerta;

/**
 * Regra de alerta: 3 lotes consecutivos do mesmo processo com litros estritamente acima do esperado.
 *
 * Restrição do banco: alerta_lote tem PK só em lote_id, então um lote pertence a no máximo um alerta.
 * Por isso, ao registrar um lote acima do esperado:
 *  1. se o lote anterior do processo também está acima e pertence a um alerta aberto ou em análise,
 *     o novo lote é anexado a esse alerta (a sequência continua);
 *  2. senão, se os 3 lotes mais recentes estão acima e nenhum pertence a alerta algum, cria-se um alerta;
 *  3. caso contrário, nada acontece. Lotes de alertas resolvidos nunca são reaproveitados:
 *     depois de uma resolução é preciso uma nova sequência de 3 lotes.
 */
public final class RegraDeAlerta {

    public static final int LOTES_CONSECUTIVOS = 3;

    private RegraDeAlerta() {}

    /** Lote avaliado; alertaId/statusAlerta são nulos quando o lote não pertence a alerta. */
    public record LoteAvaliado(Integer id, boolean acima, Integer alertaId, StatusAlerta statusAlerta) {
        boolean semAlerta() { return alertaId == null; }
        boolean emAlertaAtivo() { return alertaId != null && statusAlerta != StatusAlerta.resolvido; }
    }

    public sealed interface Decisao permits Nenhuma, Anexar, Criar {}
    public record Nenhuma() implements Decisao {}
    public record Anexar(Integer alertaId) implements Decisao {}
    /** loteIds do mais antigo ao mais recente. */
    public record Criar(List<Integer> loteIds) implements Decisao {}

    /** @param recentes lotes do processo do mais recente (o recém-registrado) ao mais antigo; até 3. */
    public static Decisao decidir(List<LoteAvaliado> recentes) {
        if (recentes.isEmpty() || !recentes.get(0).acima()) return new Nenhuma();

        if (recentes.size() >= 2) {
            LoteAvaliado anterior = recentes.get(1);
            if (anterior.acima() && anterior.emAlertaAtivo()) return new Anexar(anterior.alertaId());
        }

        if (recentes.size() < LOTES_CONSECUTIVOS) return new Nenhuma();
        List<LoteAvaliado> janela = recentes.subList(0, LOTES_CONSECUTIVOS);
        if (janela.stream().allMatch(l -> l.acima() && l.semAlerta())) {
            return new Criar(janela.reversed().stream().map(LoteAvaliado::id).toList());
        }
        return new Nenhuma();
    }
}
