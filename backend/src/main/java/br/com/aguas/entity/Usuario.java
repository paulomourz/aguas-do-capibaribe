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
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(nullable = false, length = 60, unique = true)
    private String login;

    /** Sempre hash BCrypt (60 caracteres, CHECK no banco). */
    @Column(name = "senha_hash", nullable = false, length = 60)
    private String senhaHash;

    /** SHA-256 (hexadecimal) do token de API da conta de sensor; null se a conta não tem token. */
    @Column(name = "token_hash", length = 64, unique = true)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Perfil perfil;

    @Column(nullable = false)
    private boolean ativo = true;

    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime criadoEm;

    protected Usuario() {}

    public Usuario(String nome, String login, String senhaHash, Perfil perfil) {
        this.nome = nome;
        this.login = login;
        this.senhaHash = senhaHash;
        this.perfil = perfil;
    }

    public Integer getId() { return id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getLogin() { return login; }
    public String getSenhaHash() { return senhaHash; }
    public void setSenhaHash(String senhaHash) { this.senhaHash = senhaHash; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public Perfil getPerfil() { return perfil; }
    public boolean isAtivo() { return ativo; }
    public void setAtivo(boolean ativo) { this.ativo = ativo; }

    public void setPerfil(Perfil perfil) { this.perfil = perfil; }
    public OffsetDateTime getCriadoEm() { return criadoEm; }
}
