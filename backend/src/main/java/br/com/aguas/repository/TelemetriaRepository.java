package br.com.aguas.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import br.com.aguas.dto.UltimaLeituraDTO;
import br.com.aguas.entity.Telemetria;

public interface TelemetriaRepository extends JpaRepository<Telemetria, Integer> {

    /** Hora da leitura mais recente de todas; null se o sensor nunca enviou nada. Usa o índice ix_telemetria_data. */
    @Query("select max(t.registradoEm) from Telemetria t")
    OffsetDateTime ultimaLeitura();

    /**
     * Linhas de lavagem ativas: os processos com leitura a partir de {@code desde}, cada um com a sua última
     * leitura, da mais recente à mais antiga. Lê só o período pedido (índice ix_telemetria_data).
     */
    @Query("""
            select new br.com.aguas.dto.UltimaLeituraDTO(p.id, p.nome, max(t.registradoEm))
            from Telemetria t join Processo p on p.id = t.processoId
            where t.registradoEm >= :desde
            group by p.id, p.nome
            order by max(t.registradoEm) desc, p.id
            """)
    List<UltimaLeituraDTO> ultimaLeituraPorLinhaAtiva(OffsetDateTime desde);
}
