package br.com.aguas.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
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
 * Preço do m³ que vale a partir de "vigencia". O trigger trg_preco_m3_imutavel bloqueia UPDATE e DELETE,
 * por isso a entidade é @Immutable; "cadastradoEm" é preenchido pelo banco.
 */
@Entity
@Immutable
@Table(name = "preco_m3")
public class PrecoM3 {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false)
    private LocalDate vigencia;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Generated(event = EventType.INSERT)
    @Column(name = "cadastrado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime cadastradoEm;

    protected PrecoM3() {}

    public PrecoM3(BigDecimal valor, LocalDate vigencia, Integer usuarioId) {
        this.valor = valor;
        this.vigencia = vigencia;
        this.usuarioId = usuarioId;
    }

    public Integer getId() { return id; }
    public BigDecimal getValor() { return valor; }
    public LocalDate getVigencia() { return vigencia; }
    public Integer getUsuarioId() { return usuarioId; }
    public OffsetDateTime getCadastradoEm() { return cadastradoEm; }
}
