package br.com.aguas.entity;

import java.time.OffsetDateTime;

import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Aviso de alerta que não chegou ao Telegram depois de todas as tentativas. Guarda quantas vezes a API
 * tentou e o último erro (tipo da exceção ou status HTTP). Não tem a mensagem nem o token do bot.
 */
@Entity
@Table(name = "aviso_pendente")
public class AvisoPendente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "alerta_id", nullable = false, unique = true)
    private Integer alertaId;

    @Column(nullable = false)
    private int tentativas;

    @Column(name = "ultimo_erro", nullable = false, length = 60)
    private String ultimoErro;

    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime criadoEm;

    protected AvisoPendente() {}

    public AvisoPendente(Integer alertaId, int tentativas, String ultimoErro) {
        this.alertaId = alertaId;
        this.tentativas = tentativas;
        this.ultimoErro = ultimoErro;
    }

    public Integer getId() { return id; }
    public Integer getAlertaId() { return alertaId; }
    public int getTentativas() { return tentativas; }
    public String getUltimoErro() { return ultimoErro; }
    public OffsetDateTime getCriadoEm() { return criadoEm; }
}
