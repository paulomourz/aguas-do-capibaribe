package br.com.aguas.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.aguas.entity.AvisoPendente;

public interface AvisoPendenteRepository extends JpaRepository<AvisoPendente, Integer> {

    /** Avisos que ainda não chegaram ao Telegram e foram gravados depois de {@code desde}, do mais antigo ao mais novo. */
    List<AvisoPendente> findByEnviadoEmIsNullAndCriadoEmAfterOrderByIdAsc(OffsetDateTime desde);
}
