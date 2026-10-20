package br.com.aguas.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.Alerta;
import br.com.aguas.entity.StatusAlerta;

public interface AlertaRepository extends JpaRepository<Alerta, Integer> {

    List<Alerta> findAllByOrderByDetectadoEmDescIdDesc();

    List<Alerta> findByStatusOrderByDetectadoEmDescIdDesc(StatusAlerta status);
}
