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
 * Um descarte de efluentes de um lote (V12, issue #162): volume, pH, turbidez e quanto da água foi reaproveitado.
 * É registro de auditoria ambiental (CPRH e ISO 14001), por isso @Immutable: o aguas_api só pode inserir.
 * "dataDescarte" vem do banco (DEFAULT now()), nunca de quem envia.
 */
@Entity
@Immutable
@Table(name = "efluentes_descarte")
public class DescarteEfluente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "lote_id", nullable = false)
    private Integer loteId;

    @Generated(event = EventType.INSERT)
    @Column(name = "data_descarte", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime dataDescarte;

    @Column(name = "volume_litros", nullable = false, precision = 12, scale = 2)
    private BigDecimal volumeLitros;

    @Column(name = "ph", nullable = false, precision = 4, scale = 2)
    private BigDecimal ph;

    @Column(name = "turbidez_ntu", nullable = false, precision = 10, scale = 2)
    private BigDecimal turbidezNtu;

    @Column(name = "reutilizado_percentual", nullable = false, precision = 5, scale = 2)
    private BigDecimal reutilizadoPercentual;

    protected DescarteEfluente() {}

    public DescarteEfluente(Integer loteId, BigDecimal volumeLitros, BigDecimal ph, BigDecimal turbidezNtu,
                            BigDecimal reutilizadoPercentual) {
        this.loteId = loteId;
        this.volumeLitros = volumeLitros;
        this.ph = ph;
        this.turbidezNtu = turbidezNtu;
        this.reutilizadoPercentual = reutilizadoPercentual;
    }

    public Integer getId() { return id; }
    public Integer getLoteId() { return loteId; }
    public OffsetDateTime getDataDescarte() { return dataDescarte; }
    public BigDecimal getVolumeLitros() { return volumeLitros; }
    public BigDecimal getPh() { return ph; }
    public BigDecimal getTurbidezNtu() { return turbidezNtu; }
    public BigDecimal getReutilizadoPercentual() { return reutilizadoPercentual; }
}
