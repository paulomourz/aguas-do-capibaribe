package br.com.aguas.service;

/**
 * LGPD (RNF27): o login de outra pessoa só sai inteiro da API quando é necessário, ou seja, para o administrador
 * na lista de usuários, que precisa dele para criar e cuidar das contas. Nos outros lugares vai mascarado, e o
 * nome continua inteiro para identificar quem fez cada ação.
 */
public final class Privacidade {

    static final String OCULTO = "****";

    private Privacidade() {}

    /**
     * Mostra no máximo metade do login, e sempre quatro asteriscos, para não revelar o tamanho:
     * "carlos.martin" → "ca****in"; "maria" → "m****a"; "ana" → "a****".
     */
    public static String mascararLogin(String login) {
        if (login == null) return null;
        int n = login.length();
        if (n == 0) return OCULTO;
        if (n <= 4) return login.charAt(0) + OCULTO;
        if (n < 8) return login.charAt(0) + OCULTO + login.charAt(n - 1);
        return login.substring(0, 2) + OCULTO + login.substring(n - 2);
    }
}
