package br.com.aguas.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import br.com.aguas.dto.ResumoProcessoDTO;
import br.com.aguas.entity.Lote;
import jakarta.persistence.criteria.Predicate;

public interface LoteRepository extends JpaRepository<Lote, Integer>, JpaSpecificationExecutor<Lote> {

    /** Os dois lotes anteriores a um lote, no mesmo processo, do mais recente ao mais antigo. */
    List<Lote> findTop2ByProcessoIdAndIdNotOrderByRegistradoEmDescIdDesc(Integer processoId, Integer id);

    @Query("""
            select new br.com.aguas.dto.ResumoProcessoDTO(l.processoId, sum(l.litros), sum(l.esperado), count(l))
            from Lote l
            where l.registradoEm >= :inicio and l.registradoEm < :fim
            group by l.processoId
            order by l.processoId
            """)
    List<ResumoProcessoDTO> resumir(OffsetDateTime inicio, OffsetDateTime fim);

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
