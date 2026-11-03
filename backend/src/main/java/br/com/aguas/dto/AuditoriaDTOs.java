package br.com.aguas.dto;

import java.time.Instant;
import java.util.List;

import br.com.aguas.entity.AcaoAuditoria;

/** Formato de GET /auditoria (src/services/tipos.ts). Só identifica as pessoas: nenhuma senha ou hash. */
public final class AuditoriaDTOs {

    private AuditoriaDTOs() {}

    public record PessoaDTO(Integer id, String nome, String usuario) {}

    public record RegistroAuditoriaDTO(Integer id, AcaoAuditoria acao, Instant data, PessoaDTO gestor, PessoaDTO usuarioAfetado) {}

    public record PaginaAuditoriaDTO(List<RegistroAuditoriaDTO> itens, long total, int pagina, int tamanho) {}
}
