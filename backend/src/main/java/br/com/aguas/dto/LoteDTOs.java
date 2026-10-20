package br.com.aguas.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

import br.com.aguas.entity.Lote;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public final class LoteDTOs {

    private LoteDTOs() {}

    /** "data" = lote.registrado_em; "desvio" em %, mesma fórmula da view v_historico_lotes. */
    public record LoteDTO(Integer id, Integer processoId, Integer pecas, BigDecimal litros, BigDecimal esperado,
                          BigDecimal desvio, Instant data, Integer usuarioId) {
        public static LoteDTO de(Lote l) {
            return new LoteDTO(l.getId(), l.getProcessoId(), l.getPecas(), l.getLitros(), l.getEsperado(),
                    calcularDesvio(l.getLitros(), l.getEsperado()), l.getRegistradoEm().toInstant(), l.getUsuarioId());
        }
    }

    /** round(((litros - esperado) / esperado) * 100, 2), como em v_historico_lotes. */
    public static BigDecimal calcularDesvio(BigDecimal litros, BigDecimal esperado) {
        return litros.subtract(esperado)
                .divide(esperado, 20, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    public record NovoLoteDTO(
            @NotNull(message = "Selecione o processo do lote.")
            Integer processoId,
            @NotNull(message = "Informe a quantidade de peças.")
            @Positive(message = "A quantidade de peças deve ser um número inteiro maior que zero.")
            Integer pecas,
            @NotNull(message = "Informe os litros utilizados.")
            @Positive(message = "Os litros utilizados devem ser maiores que zero.")
            @Digits(integer = 10, fraction = 2, message = "Os litros aceitam até 10 dígitos inteiros e 2 casas decimais.")
            BigDecimal litros) {}
}
