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
 * Lote registrado. No banco:
 * - "esperado" é calculado pelo trigger trg_lote_esperado (não é enviado no INSERT);
 * - o trigger trg_lote_imutavel bloqueia UPDATE e DELETE, por isso a entidade é @Immutable.
 */
@Entity
@Immutable
@Table(name = "lote")
public class Lote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "processo_id", nullable = false)
    private Integer processoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(nullable = false)
    private Integer pecas;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal litros;

    @Generated(event = EventType.INSERT)
    @Column(nullable = false, precision = 14, scale = 2, insertable = false, updatable = false)
    private BigDecimal esperado;

    @Generated(event = EventType.INSERT)
    @Column(name = "registrado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime registradoEm;

    protected Lote() {}

    public Lote(Integer processoId, Integer usuarioId, Integer pecas, BigDecimal litros) {
        this.processoId = processoId;
        this.usuarioId = usuarioId;
        this.pecas = pecas;
        this.litros = litros;
    }

    public Integer getId() { return id; }
    public Integer getProcessoId() { return processoId; }
    public Integer getUsuarioId() { return usuarioId; }
    public Integer getPecas() { return pecas; }
    public BigDecimal getLitros() { return litros; }
    public BigDecimal getEsperado() { return esperado; }
    public OffsetDateTime getRegistradoEm() { return registradoEm; }

    /** Regra de alerta: acima da meta = litros estritamente maior que o esperado, sem tolerância. */
    public boolean acimaDoEsperado() {
        return litros.compareTo(esperado) > 0;
    }
}
