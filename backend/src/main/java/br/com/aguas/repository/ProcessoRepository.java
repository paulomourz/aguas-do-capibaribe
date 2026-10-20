package br.com.aguas.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import br.com.aguas.entity.Processo;
import jakarta.persistence.LockModeType;

public interface ProcessoRepository extends JpaRepository<Processo, Integer> {

    boolean existsByNomeIgnoreCase(String nome);

    boolean existsByNomeIgnoreCaseAndIdNot(String nome, Integer id);

    /**
     * SELECT ... FOR UPDATE no processo: serializa registros de lote do mesmo processo,
     * para que a regra de alerta veja sempre a sequência completa e nunca dispute um lote.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Processo p where p.id = :id")
    Optional<Processo> buscarComBloqueio(Integer id);
}
