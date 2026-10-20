package br.com.aguas.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.AlertaDTOs.AlertaDTO;
import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.AlertaLote;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.AlertaLoteRepository;
import br.com.aguas.repository.AlertaRepository;

@Service
public class AlertaService {

    private final AlertaRepository alertas;
    private final AlertaLoteRepository vinculos;

    public AlertaService(AlertaRepository alertas, AlertaLoteRepository vinculos) {
        this.alertas = alertas;
        this.vinculos = vinculos;
    }

    @Transactional(readOnly = true)
    public List<AlertaDTO> listar(StatusAlerta status) {
        List<Alerta> lista = status == null
                ? alertas.findAllByOrderByDetectadoEmDescIdDesc()
                : alertas.findByStatusOrderByDetectadoEmDescIdDesc(status);
        if (lista.isEmpty()) return List.of();
        Map<Integer, List<Integer>> lotesPorAlerta = vinculos.findByAlertaIdIn(lista.stream().map(Alerta::getId).toList())
                .stream()
                .sorted(Comparator.comparing(AlertaLote::getLoteId))
                .collect(Collectors.groupingBy(AlertaLote::getAlertaId, Collectors.mapping(AlertaLote::getLoteId, Collectors.toList())));
        return lista.stream().map(a -> AlertaDTO.de(a, lotesPorAlerta.getOrDefault(a.getId(), List.of()))).toList();
    }

    @Transactional
    public AlertaDTO mudarStatus(Integer id, StatusAlerta novo) {
        Alerta a = alertas.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Alerta não encontrado."));
        if (!a.getStatus().podeIrPara(novo)) {
            throw new ApiException(HttpStatus.CONFLICT, "TRANSICAO_INVALIDA",
                    "Não é possível mudar o alerta de \"" + a.getStatus() + "\" para \"" + novo + "\".", null);
        }
        a.mudarStatus(novo);
        alertas.flush();
        List<Integer> loteIds = vinculos.findByAlertaIdIn(List.of(id)).stream()
                .map(AlertaLote::getLoteId).sorted().toList();
        return AlertaDTO.de(a, loteIds);
    }
}
