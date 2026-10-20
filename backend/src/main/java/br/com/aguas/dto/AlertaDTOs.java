package br.com.aguas.dto;

import java.time.Instant;
import java.util.List;

import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.StatusAlerta;
import jakarta.validation.constraints.NotNull;

public final class AlertaDTOs {

    private AlertaDTOs() {}

    public record AlertaDTO(Integer id, Integer processoId, List<Integer> loteIds, Instant detectado, StatusAlerta status) {
        public static AlertaDTO de(Alerta a, List<Integer> loteIds) {
            return new AlertaDTO(a.getId(), a.getProcessoId(), loteIds, a.getDetectadoEm().toInstant(), a.getStatus());
        }
    }

    public record MudarStatusDTO(@NotNull(message = "Informe o novo status.") StatusAlerta status) {}
}
