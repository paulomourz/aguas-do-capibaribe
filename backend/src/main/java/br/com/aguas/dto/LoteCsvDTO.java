package br.com.aguas.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Só as colunas do lote que o CSV usa, lidas direto da consulta (sem carregar a entidade). */
public record LoteCsvDTO(Integer id, OffsetDateTime registradoEm, Integer processoId, Integer usuarioId,
                         Integer pecas, BigDecimal litros, BigDecimal esperado) {}
