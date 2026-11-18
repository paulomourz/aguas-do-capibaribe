package br.com.aguas.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.Telemetria;

public interface TelemetriaRepository extends JpaRepository<Telemetria, Integer> {
}
