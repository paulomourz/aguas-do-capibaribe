package br.com.aguas.service;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.ProcessoDTOs.ProcessoDTO;
import br.com.aguas.dto.ProcessoDTOs.SalvarProcessoDTO;
import br.com.aguas.entity.Processo;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.ProcessoRepository;

@Service
public class ProcessoService {

    private final ProcessoRepository processos;

    public ProcessoService(ProcessoRepository processos) {
        this.processos = processos;
    }

    @Transactional(readOnly = true)
    public List<ProcessoDTO> listar() {
        return processos.findAll(Sort.by("id")).stream().map(ProcessoDTO::de).toList();
    }

    @Transactional
    public ProcessoDTO criar(SalvarProcessoDTO dados) {
        String nome = dados.nome().trim();
        if (processos.existsByNomeIgnoreCase(nome)) throw duplicado();
        return ProcessoDTO.de(processos.save(new Processo(nome, dados.unidade(), dados.meta())));
    }

    /** Alterar a meta não muda lotes já registrados: o esperado de cada lote fica gravado no banco. */
    @Transactional
    public ProcessoDTO atualizar(Integer id, SalvarProcessoDTO dados) {
        Processo p = processos.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Processo não encontrado."));
        String nome = dados.nome().trim();
        if (processos.existsByNomeIgnoreCaseAndIdNot(nome, id)) throw duplicado();
        p.setNome(nome);
        p.setUnidade(dados.unidade());
        p.setMeta(dados.meta());
        processos.flush();
        return ProcessoDTO.de(p);
    }

    private static ApiException duplicado() {
        return ApiException.conflito("PROCESSO_DUPLICADO", "Já existe um processo com esse nome.", "nome");
    }
}
