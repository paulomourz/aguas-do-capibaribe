package br.com.aguas.dto;

import java.math.BigDecimal;

/** Consumo de um processo no mês: litros reais, litros esperados pela meta e quantidade de lotes. */
public record ResumoProcessoDTO(Integer processoId, BigDecimal real, BigDecimal esperado, Long lotes) {}
