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

    /**
     * IP no painel de segurança: mostra a rede, para ver se as tentativas vêm do mesmo lugar, sem identificar a
     * máquina. IPv4 esconde o último número ("200.17.33.45" → "200.17.33.***"); IPv6 mostra só os 4 primeiros
     * grupos ("2804:14c:65:8a00:..." → "2804:14c:65:8a00:****").
     */
    public static String mascararIp(String ip) {
        if (ip == null || ip.isBlank()) return OCULTO;
        String limpo = ip.trim();
        if (limpo.indexOf(':') >= 0) {
            String[] grupos = limpo.split(":", -1);
            if (grupos.length < 5) return OCULTO;
            return String.join(":", grupos[0], grupos[1], grupos[2], grupos[3]) + ":" + OCULTO;
        }
        int ultimoPonto = limpo.lastIndexOf('.');
        return ultimoPonto < 0 ? OCULTO : limpo.substring(0, ultimoPonto) + ".***";
    }
}
