package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.aguas.dto.ResumoProcessoDTO;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Pegada hídrica do resumo mensal (#116): litros por peça = litros reais ÷ peças, com 2 casas. */
class PegadaHidricaTest {

    @Test
    void litrosPorPecaDivideOsLitrosPelasPecas() {
        var r = new ResumoProcessoDTO(1, new BigDecimal("1200.00"), new BigDecimal("1100.00"), 2L, 20L);
        assertThat(r.pecas()).isEqualTo(20L);
        assertThat(r.litrosPorPeca()).isEqualByComparingTo("60.00");
    }

    @Test
    void arredondaParaDuasCasas() {
        // 100 ÷ 3 = 33,333... → 33,33; 200 ÷ 3 = 66,666... → 66,67
        assertThat(ResumoProcessoDTO.litrosPorPeca(new BigDecimal("100"), 3L)).isEqualByComparingTo("33.33");
        assertThat(ResumoProcessoDTO.litrosPorPeca(new BigDecimal("200"), 3L)).isEqualByComparingTo("66.67");
    }

    @Test
    void semPecasNaoHaPegada() {
        assertThat(ResumoProcessoDTO.litrosPorPeca(new BigDecimal("100"), 0L)).isNull();
        assertThat(ResumoProcessoDTO.litrosPorPeca(new BigDecimal("100"), null)).isNull();
        assertThat(ResumoProcessoDTO.litrosPorPeca(null, 5L)).isNull();
    }
}
