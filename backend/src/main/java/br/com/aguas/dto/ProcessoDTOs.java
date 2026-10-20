package br.com.aguas.dto;

import java.math.BigDecimal;

import br.com.aguas.entity.Processo;
import br.com.aguas.entity.Unidade;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class ProcessoDTOs {

    private ProcessoDTOs() {}

    public record ProcessoDTO(Integer id, String nome, Unidade unidade, BigDecimal meta) {
        public static ProcessoDTO de(Processo p) {
            return new ProcessoDTO(p.getId(), p.getNome(), p.getUnidade(), p.getMeta());
        }
    }

    /** Corpo de POST /processos e PUT /processos/{id}. Um "id" no corpo é ignorado; vale o da URL. */
    public record SalvarProcessoDTO(
            @NotBlank(message = "Informe o nome do processo.")
            @Size(max = 80, message = "O nome pode ter no máximo 80 caracteres.")
            String nome,
            @NotNull(message = "Escolha a unidade da meta.")
            Unidade unidade,
            @NotNull(message = "Informe o valor da meta.")
            @Positive(message = "A meta deve ser maior que zero.")
            @Digits(integer = 8, fraction = 2, message = "A meta aceita até 8 dígitos inteiros e 2 casas decimais.")
            BigDecimal meta) {}
}
