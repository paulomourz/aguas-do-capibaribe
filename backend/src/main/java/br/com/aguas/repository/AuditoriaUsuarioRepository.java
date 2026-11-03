package br.com.aguas.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import jakarta.persistence.criteria.Predicate;

public interface AuditoriaUsuarioRepository extends JpaRepository<AuditoriaUsuario, Integer>, JpaSpecificationExecutor<AuditoriaUsuario> {

    static Specification<AuditoriaUsuario> filtro(OffsetDateTime inicio, OffsetDateTime fim, AcaoAuditoria acao) {
        return (root, query, cb) -> {
            var condicoes = new ArrayList<Predicate>();
            if (inicio != null) condicoes.add(cb.greaterThanOrEqualTo(root.get("dataHora"), inicio));
            if (fim != null) condicoes.add(cb.lessThanOrEqualTo(root.get("dataHora"), fim));
            if (acao != null) condicoes.add(cb.equal(root.get("acao"), acao));
            return cb.and(condicoes.toArray(Predicate[]::new));
        };
    }
}
