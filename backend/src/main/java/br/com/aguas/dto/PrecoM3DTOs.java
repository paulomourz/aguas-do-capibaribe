package br.com.aguas.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public final class PrecoM3DTOs {

    private PrecoM3DTOs() {}

    /** Um preço do histórico; cadastradoPor é o nome de quem cadastrou. */
    public record PrecoM3DTO(Integer id, BigDecimal valor, LocalDate vigencia, String cadastradoPor, Instant cadastradoEm) {}

    /** Corpo de POST /precos-m3. Quem cadastrou vem do token; um campo com outro usuário no corpo é ignorado. */
    public record NovoPrecoM3DTO(
            @NotNull(message = "Informe o preço do m³.")
            @Positive(message = "O preço do m³ deve ser maior que zero.")
            @Digits(integer = 8, fraction = 2, message = "O preço do m³ aceita até 8 dígitos inteiros e 2 casas decimais.")
            BigDecimal valor,
            @NotNull(message = "Informe a data a partir da qual o preço vale.")
            LocalDate vigencia) {}
}
