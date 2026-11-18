package br.com.aguas.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Corpo de POST /telemetria: uma leitura de vazão enviada pelo sensor (RNF04, ERS seção 4.1).
 * Campo nulo, negativo ou fora da faixa é recusado com 400 antes de chegar à regra de negócio.
 */
public record TelemetriaRequestDTO(
        @NotNull(message = "Informe o processo da leitura.")
        @Min(value = 1, message = "O processo deve ser um número inteiro maior que zero.")
        Integer processoId,

        @NotNull(message = "Informe a vazão em litros.")
        @PositiveOrZero(message = "A vazão em litros não pode ser negativa.")
        @Max(value = 10000, message = "A vazão em litros não pode passar de 10000.")
        @Digits(integer = 5, fraction = 2, message = "A vazão aceita até 5 dígitos inteiros e 2 casas decimais.")
        BigDecimal vazaoLitros) {}
