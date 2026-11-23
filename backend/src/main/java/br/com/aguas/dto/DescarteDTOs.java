package br.com.aguas.dto;

import java.math.BigDecimal;
import java.time.Instant;

import br.com.aguas.entity.DescarteEfluente;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Descarte de efluentes de um lote (issue #201). Os limites são os mesmos das restrições da V12. */
public final class DescarteDTOs {

    private DescarteDTOs() {}

    /** "data" = efluentes_descarte.data_descarte, a hora em que o servidor gravou. */
    public record DescarteDTO(Integer id, Integer loteId, Instant data, BigDecimal volumeLitros, BigDecimal ph,
                              BigDecimal turbidezNtu, BigDecimal reutilizadoPercentual) {
        public static DescarteDTO de(DescarteEfluente d) {
            return new DescarteDTO(d.getId(), d.getLoteId(), d.getDataDescarte().toInstant(), d.getVolumeLitros(),
                    d.getPh(), d.getTurbidezNtu(), d.getReutilizadoPercentual());
        }
    }

    /** reutilizadoPercentual é opcional: sem ele, nada foi reaproveitado (0%, o padrão da V12). */
    public record NovoDescarteDTO(
            @NotNull(message = "Informe o volume descartado.")
            @Positive(message = "O volume descartado deve ser maior que zero.")
            @Digits(integer = 10, fraction = 2, message = "O volume aceita até 10 dígitos inteiros e 2 casas decimais.")
            BigDecimal volumeLitros,
            @NotNull(message = "Informe o pH do efluente.")
            @DecimalMin(value = "0", message = "O pH vai de 0 a 14.")
            @DecimalMax(value = "14", message = "O pH vai de 0 a 14.")
            @Digits(integer = 2, fraction = 2, message = "O pH aceita até 2 casas decimais.")
            BigDecimal ph,
            @NotNull(message = "Informe a turbidez, em NTU.")
            @DecimalMin(value = "0", message = "A turbidez não pode ser negativa.")
            @Digits(integer = 8, fraction = 2, message = "A turbidez aceita até 8 dígitos inteiros e 2 casas decimais.")
            BigDecimal turbidezNtu,
            @DecimalMin(value = "0", message = "O reaproveitamento vai de 0% a 100%.")
            @DecimalMax(value = "100", message = "O reaproveitamento vai de 0% a 100%.")
            @Digits(integer = 3, fraction = 2, message = "O reaproveitamento aceita até 2 casas decimais.")
            BigDecimal reutilizadoPercentual) {

        public BigDecimal reutilizadoOuZero() {
            return reutilizadoPercentual == null ? BigDecimal.ZERO : reutilizadoPercentual;
        }
    }
}
