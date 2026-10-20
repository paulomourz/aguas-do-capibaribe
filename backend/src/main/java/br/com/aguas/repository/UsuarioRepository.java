package br.com.aguas.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.Usuario;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    Optional<Usuario> findByLoginIgnoreCase(String login);

    boolean existsByLoginIgnoreCase(String login);
}
