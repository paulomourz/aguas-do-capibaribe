package br.com.aguas.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.AuditoriaUsuario;

public interface AuditoriaUsuarioRepository extends JpaRepository<AuditoriaUsuario, Integer> {
}
