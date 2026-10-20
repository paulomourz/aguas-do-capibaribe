package br.com.aguas.entity;

import org.springframework.data.domain.Persistable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * Vínculo lote → alerta. A chave primária é só lote_id: cada lote pertence a no máximo um alerta.
 * Implementa Persistable para que save() faça sempre INSERT (nunca UPDATE silencioso de um vínculo
 * existente); se o lote já tiver alerta, o banco recusa pela PK.
 */
@Entity
@Table(name = "alerta_lote")
public class AlertaLote implements Persistable<Integer> {

    @Id
    @Column(name = "lote_id")
    private Integer loteId;

    @Column(name = "alerta_id", nullable = false)
    private Integer alertaId;

    @Transient
    private boolean novo = true;

    protected AlertaLote() {}

    public AlertaLote(Integer loteId, Integer alertaId) {
        this.loteId = loteId;
        this.alertaId = alertaId;
    }

    public Integer getLoteId() { return loteId; }
    public Integer getAlertaId() { return alertaId; }

    @Override
    public Integer getId() { return loteId; }

    @Override
    public boolean isNew() { return novo; }

    @PostLoad
    @PostPersist
    void marcarExistente() { this.novo = false; }
}
