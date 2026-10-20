package br.com.aguas.ferramentas;

import java.io.BufferedReader;
import java.io.Console;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Gera o hash BCrypt de uma senha para criar o primeiro gestor diretamente no banco (ver README).
 * Não grava nada em lugar nenhum; apenas imprime o hash. A senha nunca é aceita como argumento
 * de linha de comando, para não ficar no histórico do terminal.
 *
 * Uso (na pasta backend): mvn -q compile exec:java
 */
public final class GerarHashSenha {

    private GerarHashSenha() {}

    public static void main(String[] args) throws IOException {
        if (args.length > 0) {
            System.err.println("Não passe a senha como argumento. Execute sem argumentos e digite quando solicitado.");
            System.exit(2);
        }
        char[] senha;
        char[] confirmacao;
        Console console = System.console();
        if (console != null) {
            senha = console.readPassword("Senha do gestor: ");
            confirmacao = console.readPassword("Repita a senha: ");
        } else {
            System.err.println("Aviso: este terminal não oculta a digitação. Prefira um terminal interativo.");
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            System.err.print("Senha do gestor: ");
            senha = lerLinha(in);
            System.err.print("Repita a senha: ");
            confirmacao = lerLinha(in);
        }
        try {
            if (!Arrays.equals(senha, confirmacao)) sair("As senhas não são iguais.");
            if (senha.length < 8) sair("A senha precisa ter pelo menos 8 caracteres.");
            if (new String(senha).getBytes(StandardCharsets.UTF_8).length > 72) sair("A senha passa de 72 bytes (limite do BCrypt).");
            String hash = new BCryptPasswordEncoder().encode(new String(senha));
            System.out.println();
            System.out.println("Hash BCrypt (copie a linha abaixo inteira):");
            System.out.println(hash);
        } finally {
            Arrays.fill(senha, '\0');
            Arrays.fill(confirmacao, '\0');
        }
    }

    private static char[] lerLinha(BufferedReader in) throws IOException {
        String linha = in.readLine();
        return linha == null ? new char[0] : linha.toCharArray();
    }

    private static void sair(String msg) {
        System.err.println(msg);
        System.exit(1);
    }
}
