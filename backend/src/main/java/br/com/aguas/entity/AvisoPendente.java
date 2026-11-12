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
 * A rotina de reenvio (ReenvioDeAvisos) tenta de novo e, quando o aviso chega, preenche enviadoEm.
 * Só tentativas, ultimoErro e enviadoEm mudam depois do INSERT (é o que o aguas_api pode atualizar, V11).
 */
@Entity
@Table(name = "aviso_pendente")
public class AvisoPendente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "alerta_id", nullable = false, unique = true, updatable = false)
    private Integer alertaId;

    @Column(nullable = false)
    private int tentativas;

    @Column(name = "ultimo_erro", nullable = false, length = 60)
    private String ultimoErro;

    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime criadoEm;

    /** Hora em que o aviso enfim chegou ao Telegram; vazio enquanto continua pendente. */
    @Column(name = "enviado_em")
    private OffsetDateTime enviadoEm;

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
    public OffsetDateTime getEnviadoEm() { return enviadoEm; }

    /** O reenvio deu certo: conta a tentativa e guarda a hora. */
    public void marcarEnviado(OffsetDateTime quando) {
        this.tentativas++;
        this.enviadoEm = quando;
    }

    /** O reenvio falhou de novo: conta a tentativa e guarda o erro (só o tipo ou o status HTTP). */
    public void registrarFalha(String erro) {
        this.tentativas++;
        this.ultimoErro = erro;
    }
}
