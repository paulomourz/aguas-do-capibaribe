package br.com.aguas.service;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.AuditoriaDTOs.PaginaAuditoriaDTO;
import br.com.aguas.dto.AuditoriaDTOs.PessoaDTO;
import br.com.aguas.dto.AuditoriaDTOs.RegistroAuditoriaDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.AuditoriaUsuarioRepository;
import br.com.aguas.repository.UsuarioRepository;

/** Consulta dos registros de auditoria, do mais recente ao mais antigo. */
@Service
public class AuditoriaService {

    private static final Sort MAIS_RECENTES = Sort.by(Sort.Order.desc("dataHora"), Sort.Order.desc("id"));

    private final AuditoriaUsuarioRepository auditoria;
    private final UsuarioRepository usuarios;

    public AuditoriaService(AuditoriaUsuarioRepository auditoria, UsuarioRepository usuarios) {
        this.auditoria = auditoria;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public PaginaAuditoriaDTO listar(OffsetDateTime inicio, OffsetDateTime fim, AcaoAuditoria acao, int pagina, int tamanho) {
        Page<AuditoriaUsuario> registros = auditoria.findAll(
                AuditoriaUsuarioRepository.filtro(inicio, fim, acao), PageRequest.of(pagina, tamanho, MAIS_RECENTES));

        Set<Integer> ids = new HashSet<>();
        registros.forEach(r -> {
            ids.add(r.getGestorId());
            ids.add(r.getUsuarioAfetadoId());
        });
        Map<Integer, Usuario> pessoas = usuarios.findAllById(ids).stream()
                .collect(Collectors.toMap(Usuario::getId, Function.identity()));

        List<RegistroAuditoriaDTO> itens = registros.map(r -> new RegistroAuditoriaDTO(
                r.getId(), r.getAcao(), r.getDataHora().toInstant(),
                pessoa(pessoas, r.getGestorId()), pessoa(pessoas, r.getUsuarioAfetadoId()))).getContent();
        return new PaginaAuditoriaDTO(itens, registros.getTotalElements(), pagina, tamanho);
    }

    private static PessoaDTO pessoa(Map<Integer, Usuario> pessoas, Integer id) {
        Usuario u = pessoas.get(id);
        return new PessoaDTO(id, u == null ? null : u.getNome(), u == null ? null : u.getLogin());
    }
}
