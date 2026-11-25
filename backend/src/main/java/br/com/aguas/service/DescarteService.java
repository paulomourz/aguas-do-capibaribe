package br.com.aguas.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.DescarteDTOs.DescarteDTO;
import br.com.aguas.dto.DescarteDTOs.NovoDescarteDTO;
import br.com.aguas.entity.DescarteEfluente;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.DescarteEfluenteRepository;
import br.com.aguas.repository.LoteRepository;
import br.com.aguas.security.UsuarioAutenticado;

/**
 * Descarte de efluentes de cada lote (issue #201). Vale a mesma regra de GET /lotes/{id}: o operador só alcança os
 * lotes que registrou (os outros respondem 404, sem dizer que existem); gestor e administrador alcançam todos.
 */
@Service
public class DescarteService {

    private final DescarteEfluenteRepository descartes;
    private final LoteRepository lotes;

    public DescarteService(DescarteEfluenteRepository descartes, LoteRepository lotes) {
        this.descartes = descartes;
        this.lotes = lotes;
    }

    @Transactional(readOnly = true)
    public List<DescarteDTO> listar(UsuarioAutenticado quem, Integer loteId) {
        conferirLote(quem, loteId);
        return descartes.findByLoteIdOrderByDataDescarteDescIdDesc(loteId).stream().map(DescarteDTO::de).toList();
    }

    /** Os campos já chegam validados pelo @Valid do controller; aqui só falta conferir o lote. */
    @Transactional
    public DescarteDTO registrar(UsuarioAutenticado quem, Integer loteId, NovoDescarteDTO dados) {
        conferirLote(quem, loteId);
        DescarteEfluente novo = descartes.saveAndFlush(new DescarteEfluente(loteId, dados.volumeLitros(), dados.ph(),
                dados.turbidezNtu(), dados.reutilizadoOuZero()));
        return DescarteDTO.de(novo);
    }

    private void conferirLote(UsuarioAutenticado quem, Integer loteId) {
        boolean alcanca = lotes.findById(loteId)
                .filter(l -> quem.gestor() || l.getUsuarioId().equals(quem.id()))
                .isPresent();
        if (!alcanca) throw ApiException.naoEncontrado("Lote não encontrado.");
    }
}
