package br.com.aguas.entity;

import java.math.BigDecimal;
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
@Table(name = "processo")
public class Processo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 80, unique = true)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 4)
    private Unidade unidade;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal meta;

    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime criadoEm;

    protected Processo() {}

    public Processo(String nome, Unidade unidade, BigDecimal meta) {
        this.nome = nome;
        this.unidade = unidade;
        this.meta = meta;
    }

    public Integer getId() { return id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public Unidade getUnidade() { return unidade; }
    public void setUnidade(Unidade unidade) { this.unidade = unidade; }
    public BigDecimal getMeta() { return meta; }
    public void setMeta(BigDecimal meta) { this.meta = meta; }
    public OffsetDateTime getCriadoEm() { return criadoEm; }
}
