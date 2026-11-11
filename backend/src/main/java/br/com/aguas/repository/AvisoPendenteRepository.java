package br.com.aguas.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.AvisoPendente;

public interface AvisoPendenteRepository extends JpaRepository<AvisoPendente, Integer> {
}
