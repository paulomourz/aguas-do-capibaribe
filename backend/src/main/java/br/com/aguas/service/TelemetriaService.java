package br.com.aguas.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.TelemetriaDTO;
import br.com.aguas.dto.TelemetriaRequestDTO;
import br.com.aguas.entity.Telemetria;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.ProcessoRepository;
import br.com.aguas.repository.TelemetriaRepository;
import br.com.aguas.security.UsuarioAutenticado;

@Service
public class TelemetriaService {

    private final TelemetriaRepository telemetrias;
    private final ProcessoRepository processos;

    public TelemetriaService(TelemetriaRepository telemetrias, ProcessoRepository processos) {
        this.telemetrias = telemetrias;
        this.processos = processos;
    }

    /**
     * Grava a leitura no nome de quem está autenticado (o sensor, pelo token). Os campos já chegam validados
     * pelo @Valid do controller; aqui só falta conferir se o processo existe (422, como em POST /lotes).
     */
    @Transactional
    public TelemetriaDTO registrar(UsuarioAutenticado quem, TelemetriaRequestDTO leitura) {
        if (!processos.existsById(leitura.processoId())) {
            throw ApiException.validacao("processoId", "Selecione um processo válido.");
        }
        Telemetria nova = telemetrias.saveAndFlush(new Telemetria(leitura.processoId(), quem.id(), leitura.vazaoLitros()));
        return TelemetriaDTO.de(nova);
    }
}
