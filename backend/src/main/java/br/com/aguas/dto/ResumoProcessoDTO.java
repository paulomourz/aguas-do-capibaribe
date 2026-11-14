package br.com.aguas.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Consumo de um processo no mês: litros reais, litros esperados pela meta, quantidade de lotes, total de peças e a
 * pegada hídrica (litros por peça = litros reais ÷ peças, com 2 casas; null se não houver peças).
 */
public record ResumoProcessoDTO(Integer processoId, BigDecimal real, BigDecimal esperado, Long lotes, Long pecas,
                                BigDecimal litrosPorPeca) {

    /** Usado pela consulta do repositório: a pegada hídrica é calculada aqui, a partir dos totais. */
    public ResumoProcessoDTO(Integer processoId, BigDecimal real, BigDecimal esperado, Long lotes, Long pecas) {
        this(processoId, real, esperado, lotes, pecas, litrosPorPeca(real, pecas));
    }

    /** Litros por peça, com 2 casas (arredondamento comercial). Sem peças ou sem litros, não há pegada: null. */
    public static BigDecimal litrosPorPeca(BigDecimal litros, Long pecas) {
        if (litros == null || pecas == null || pecas <= 0) return null;
        return litros.divide(BigDecimal.valueOf(pecas), 2, RoundingMode.HALF_UP);
    }
}
