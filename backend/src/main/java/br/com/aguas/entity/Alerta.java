package br.com.aguas.entity;

import java.time.OffsetDateTime;

import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "alerta")
public class Alerta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "processo_id", nullable = false)
    private Integer processoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StatusAlerta status = StatusAlerta.aberto;

    @Generated(event = EventType.INSERT)
    @Column(name = "detectado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime detectadoEm;

    /** Preenchido quando o status muda. */
    @Column(name = "atualizado_em")
    private OffsetDateTime atualizadoEm;

    protected Alerta() {}

    public Alerta(Integer processoId) {
        this.processoId = processoId;
    }

    public Integer getId() { return id; }
    public Integer getProcessoId() { return processoId; }
    public StatusAlerta getStatus() { return status; }
    public OffsetDateTime getDetectadoEm() { return detectadoEm; }
    public OffsetDateTime getAtualizadoEm() { return atualizadoEm; }

    public void mudarStatus(StatusAlerta novo) {
        this.status = novo;
        this.atualizadoEm = OffsetDateTime.now();
    }
}
