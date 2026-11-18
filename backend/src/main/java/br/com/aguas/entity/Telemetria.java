package br.com.aguas.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.Immutable;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Uma leitura de vazão enviada pelo sensor (V14). É histórico de medição, por isso @Immutable:
 * o aguas_api só pode inserir. "registradoEm" vem do banco (DEFAULT now()), nunca do sensor.
 */
@Entity
@Immutable
@Table(name = "telemetria")
public class Telemetria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "processo_id", nullable = false)
    private Integer processoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "vazao_litros", nullable = false, precision = 7, scale = 2)
    private BigDecimal vazaoLitros;

    @Generated(event = EventType.INSERT)
    @Column(name = "registrado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime registradoEm;

    protected Telemetria() {}

    public Telemetria(Integer processoId, Integer usuarioId, BigDecimal vazaoLitros) {
        this.processoId = processoId;
        this.usuarioId = usuarioId;
        this.vazaoLitros = vazaoLitros;
    }

    public Integer getId() { return id; }
    public Integer getProcessoId() { return processoId; }
    public Integer getUsuarioId() { return usuarioId; }
    public BigDecimal getVazaoLitros() { return vazaoLitros; }
    public OffsetDateTime getRegistradoEm() { return registradoEm; }
}
