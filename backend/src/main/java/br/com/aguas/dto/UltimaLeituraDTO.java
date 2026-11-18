package br.com.aguas.dto;

import java.time.OffsetDateTime;

/** Última leitura de telemetria de uma linha de lavagem (processo) e a hora em que chegou ao servidor. */
public record UltimaLeituraDTO(Integer processoId, String processo, OffsetDateTime registradoEm) {}
