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

    /** Requisições de um IP (mascarado) bloqueadas pelo limite numa rota: "login" ou "lotes". */
    public record BloqueioDTO(String rota, String ip, Instant primeiro, Instant ultimo, long tentativas) {}

    /** Formato de GET /auditoria/seguranca. Os números contam a partir de "desde" (o último início da API). */
    public record SegurancaDTO(Instant desde, long loginsAceitos, long loginsRecusados, long bloqueiosLogin,
            long bloqueiosLotes, long senhasTrocadas, long senhasRedefinidas, List<BloqueioDTO> bloqueios) {}
}
