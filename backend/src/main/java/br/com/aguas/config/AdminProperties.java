package br.com.aguas.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.admin.*": o administrador principal que sempre existe no sistema.
 * A senha vem só de variável de ambiente (ADMIN_SENHA) e é usada apenas para criá-lo.
 */
@ConfigurationProperties("app.admin")
public record AdminProperties(String login, String nome, String senha) {

    public String loginOuPadrao() {
        return login == null || login.isBlank() ? "capibaribe.admin" : login.trim().toLowerCase();
    }

    public String nomeOuPadrao() {
        return nome == null || nome.isBlank() ? "Administrador Capibaribe" : nome.trim();
    }

    public boolean ehAdmin(String outroLogin) {
        return outroLogin != null && outroLogin.equalsIgnoreCase(loginOuPadrao());
    }
}
