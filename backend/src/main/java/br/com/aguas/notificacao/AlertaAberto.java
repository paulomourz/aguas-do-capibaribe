package br.com.aguas.notificacao;

import java.util.List;

/** Evento publicado quando a regra de alerta abre um alerta novo (3 lotes seguidos acima da meta). */
public record AlertaAberto(Integer alertaId, String processo, List<Integer> loteIds) {}
