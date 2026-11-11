package br.com.aguas.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Token de API: chave de 64 caracteres alfanuméricos, sorteada com SecureRandom (cerca de 381 bits).
 * A chave só existe na resposta da rotação; o banco guarda o SHA-256 dela. Como a chave é aleatória e
 * longa, o SHA-256 basta (não precisa de BCrypt) e permite achar a conta por índice.
 */
public final class TokenDeApi {

    public static final int TAMANHO = 64;

    private static final String ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final Pattern FORMATO = Pattern.compile("[A-Za-z0-9]{" + TAMANHO + "}");
    private static final SecureRandom SORTEIO = new SecureRandom();

    private TokenDeApi() {}

    public static String gerar() {
        StringBuilder chave = new StringBuilder(TAMANHO);
        // nextInt(limite) não tem viés: cada caractere do alfabeto sai com a mesma chance.
        for (int i = 0; i < TAMANHO; i++) chave.append(ALFABETO.charAt(SORTEIO.nextInt(ALFABETO.length())));
        return chave.toString();
    }

    /** Um JWT tem pontos, então nunca passa aqui: dá para separar os dois só pelo formato. */
    public static boolean temFormato(String valor) {
        return valor != null && FORMATO.matcher(valor).matches();
    }

    public static String hash(String chave) {
        try {
            byte[] resumo = MessageDigest.getInstance("SHA-256").digest(chave.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumo);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }
}
