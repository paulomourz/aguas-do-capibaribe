package br.com.aguas.config;

/** Ajustes de URL usados na configuração e nos avisos. */
public final class Urls {

    private Urls() {
    }

    /**
     * Tira as barras do fim da URL, sem regex: {@code "/+$"} tem backtracking quadrático (Sonar java:S5852).
     * Devolve {@code null} quando recebe {@code null}.
     */
    public static String semBarraNoFim(String url) {
        if (url == null) return null;
        int fim = url.length();
        while (fim > 0 && url.charAt(fim - 1) == '/') fim--;
        return url.substring(0, fim);
    }
}
