package br.com.aguas.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.DescarteEfluente;

public interface DescarteEfluenteRepository extends JpaRepository<DescarteEfluente, Integer> {

    /** Descartes de um lote, do mais recente ao mais antigo (índice ix_efluentes_descarte_lote). */
    List<DescarteEfluente> findByLoteIdOrderByDataDescarteDescIdDesc(Integer loteId);
}
