package br.com.aguas.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.AlertaLote;

public interface AlertaLoteRepository extends JpaRepository<AlertaLote, Integer> {

    List<AlertaLote> findByLoteIdIn(Collection<Integer> loteIds);

    List<AlertaLote> findByAlertaIdIn(Collection<Integer> alertaIds);
}
