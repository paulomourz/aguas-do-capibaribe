package br.com.aguas.entity;

import java.time.OffsetDateTime;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.Immutable;
import org.hibernate.generator.EventType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Registro de auditoria: o gestor (gestorId) fez uma ação (acao) na conta de outra pessoa
 * (usuarioAfetadoId). No banco, o trigger trg_auditoria_imutavel bloqueia UPDATE e DELETE,
 * por isso a entidade é @Immutable. Não existe campo de senha: nada de credencial é gravado aqui.
 */
@Entity
@Immutable
@Table(name = "auditoria_usuario")
public class AuditoriaUsuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "gestor_id", nullable = false)
    private Integer gestorId;

    @Column(name = "usuario_afetado_id", nullable = false)
    private Integer usuarioAfetadoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AcaoAuditoria acao;

    @Generated(event = EventType.INSERT)
    @Column(name = "data_hora", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime dataHora;

    protected AuditoriaUsuario() {}

    public AuditoriaUsuario(Integer gestorId, Integer usuarioAfetadoId, AcaoAuditoria acao) {
        this.gestorId = gestorId;
        this.usuarioAfetadoId = usuarioAfetadoId;
        this.acao = acao;
    }

    public Integer getId() { return id; }
    public Integer getGestorId() { return gestorId; }
    public Integer getUsuarioAfetadoId() { return usuarioAfetadoId; }
    public AcaoAuditoria getAcao() { return acao; }
    public OffsetDateTime getDataHora() { return dataHora; }
}
