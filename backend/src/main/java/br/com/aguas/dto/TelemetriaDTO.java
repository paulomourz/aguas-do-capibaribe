package br.com.aguas.dto;

import java.math.BigDecimal;
import java.time.Instant;

import br.com.aguas.entity.Telemetria;

/** Resposta de POST /telemetria: a leitura gravada. "data" = telemetria.registrado_em, a hora do servidor. */
public record TelemetriaDTO(Integer id, Integer processoId, BigDecimal vazaoLitros, Instant data) {

    public static TelemetriaDTO de(Telemetria t) {
        return new TelemetriaDTO(t.getId(), t.getProcessoId(), t.getVazaoLitros(), t.getRegistradoEm().toInstant());
    }
}
