package br.com.aguas.entity;

import java.math.BigDecimal;

/**
 * Faixa de conformidade do lote em relação à meta (verde / amarelo / vermelho nas telas).
 * Os totais e médias do site usam os mesmos limites (FAIXAS_DE_STATUS em src/domain/regras.ts): mudar nos dois.
 */
public enum StatusConformidade {
    DENTRO_DA_META,
    ATENCAO,
    CRITICO;

    /** Limites superiores inclusivos, em % de desvio. */
    static final BigDecimal LIMITE_DENTRO_DA_META = BigDecimal.ZERO;
    static final BigDecimal LIMITE_ATENCAO = new BigDecimal("8");

    /** desvio <= 0% → DENTRO_DA_META; desvio <= 8% → ATENCAO; acima disso → CRITICO. */
    public static StatusConformidade de(BigDecimal desvio) {
        if (desvio.compareTo(LIMITE_DENTRO_DA_META) <= 0) return DENTRO_DA_META;
        if (desvio.compareTo(LIMITE_ATENCAO) <= 0) return ATENCAO;
        return CRITICO;
    }
}
