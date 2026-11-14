package br.com.aguas.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import br.com.aguas.dto.LoteCsvDTO;
import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.entity.Lote;
import jakarta.persistence.criteria.Predicate;

public interface LoteRepository extends JpaRepository<Lote, Integer>, JpaSpecificationExecutor<Lote> {

    /** Lote já gravado com esta chave de envio (reenvio do site depois de a resposta se perder). */
    Optional<Lote> findByChaveEnvio(UUID chaveEnvio);

    /** Os dois lotes anteriores a um lote, no mesmo processo, do mais recente ao mais antigo. */
    List<Lote> findTop2ByProcessoIdAndIdNotOrderByRegistradoEmDescIdDesc(Integer processoId, Integer id);

    @Query("""
            select new br.com.aguas.dto.ResumoProcessoDTO(l.processoId, sum(l.litros), sum(l.esperado), count(l), sum(l.pecas))
            from Lote l
            where l.registradoEm >= :inicio and l.registradoEm < :fim
            group by l.processoId
            order by l.processoId
            """)
    List<ResumoProcessoDTO> resumir(OffsetDateTime inicio, OffsetDateTime fim);

    /**
     * Uma página do CSV: os lotes logo depois de (aposData, aposId), em ordem de registro, até antes de {@code fim}.
     * Paginação por cursor (keyset), não por OFFSET: cada página custa o mesmo, do começo ao fim do arquivo, e usa
     * o índice ix_lote_data. Para a primeira página, aposData = início do período e aposId = 0 (inclui os lotes
     * registrados exatamente no início). O id desempata lotes com a mesma data e hora.
     */
    @Query("""
            select new br.com.aguas.dto.LoteCsvDTO(l.id, l.registradoEm, l.processoId, l.usuarioId, l.pecas, l.litros, l.esperado)
            from Lote l
            where l.registradoEm >= :aposData and l.registradoEm < :fim
              and (l.registradoEm > :aposData or l.id > :aposId)
              and (:processoId is null or l.processoId = :processoId)
            order by l.registradoEm, l.id
            """)
    List<LoteCsvDTO> paginaDoCsv(OffsetDateTime aposData, Integer aposId, OffsetDateTime fim, Integer processoId,
                                 Limit limite);

    static Specification<Lote> filtro(Integer processoId, Integer usuarioId, OffsetDateTime inicio, OffsetDateTime fim) {
        return (root, query, cb) -> {
            var condicoes = new ArrayList<Predicate>();
            if (processoId != null) condicoes.add(cb.equal(root.get("processoId"), processoId));
            if (usuarioId != null) condicoes.add(cb.equal(root.get("usuarioId"), usuarioId));
            if (inicio != null) condicoes.add(cb.greaterThanOrEqualTo(root.get("registradoEm"), inicio));
            if (fim != null) condicoes.add(cb.lessThanOrEqualTo(root.get("registradoEm"), fim));
            return cb.and(condicoes.toArray(Predicate[]::new));
        };
    }
}
