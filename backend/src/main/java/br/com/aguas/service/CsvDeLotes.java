package br.com.aguas.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Pattern;

import br.com.aguas.dto.LoteCsvDTO;
import br.com.aguas.dto.LoteDTOs;
import br.com.aguas.entity.StatusConformidade;

/**
 * Linhas do CSV de lotes, no mesmo formato do CSV que o site gera no Histórico (src/services/historicoCsv.ts, RF29):
 * - UTF-8 com BOM (acentos certos no Excel), separador ";" e quebra de linha CRLF (RFC 4180);
 * - números com vírgula decimal, 2 casas e sem separador de milhar;
 * - data e hora no fuso dos relatórios (America/Recife) e também em UTC ISO 8601;
 * - textos digitados por usuários (processo, nome) protegidos contra fórmula ao abrir na planilha.
 * Mudar o formato aqui pede a mesma mudança no site.
 */
final class CsvDeLotes {

    static final String BOM = "\uFEFF";
    static final String SEP = ";";
    static final String FIM = "\r\n";

    static final List<String> CABECALHO = List.of(
            "ID do lote", "Data", "Hora", "Data e hora (UTC)", "Processo", "Peças", "Consumo real (L)",
            "Consumo esperado (L)", "Diferença (L)", "Desvio (%)", "Status", "Registrado por");

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");
    private static final Pattern PRECISA_ASPAS = Pattern.compile("[\";\r\n]");
    private static final Pattern PARECE_FORMULA = Pattern.compile("^[=+\\-@\t\r]");

    private CsvDeLotes() {}

    static String linhaDeCabecalho() {
        return String.join(SEP, CABECALHO) + FIM;
    }

    /** Uma linha, já com o CRLF no fim. */
    static String linha(LoteCsvDTO l, String processo, String registradoPor, ZoneId zona) {
        BigDecimal desvio = LoteDTOs.calcularDesvio(l.litros(), l.esperado());
        var local = l.registradoEm().atZoneSameInstant(zona);
        var utc = l.registradoEm().atZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS);
        return String.join(SEP,
                String.valueOf(l.id()),
                DATA.format(local),
                HORA.format(local),
                UTC.format(utc),
                texto(processo),
                String.valueOf(l.pecas()),
                numero(l.litros()),
                numero(l.esperado()),
                numero(l.litros().subtract(l.esperado())),
                numero(desvio),
                rotulo(StatusConformidade.de(desvio)),
                texto(registradoPor)) + FIM;
    }

    /** 1234.5 → "1234,50"; sem separador de milhar nem notação científica. */
    static String numero(BigDecimal n) {
        return n.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    /**
     * Texto livre: se começar com =, +, -, @, tab ou CR, a planilha executaria como fórmula (CSV injection, OWASP).
     * Um apóstrofo na frente faz a planilha mostrar o texto como está. Depois, aspas quando há separador,
     * aspas ou quebra de linha (RFC 4180).
     */
    static String texto(String v) {
        String s = PARECE_FORMULA.matcher(v).find() ? "'" + v : v;
        return PRECISA_ASPAS.matcher(s).find() ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }

    /** Mesmos rótulos do selo de status da tela (statusMeta em src/components/ui.tsx). */
    static String rotulo(StatusConformidade s) {
        return switch (s) {
            case DENTRO_DA_META -> "Dentro da meta";
            case ATENCAO -> "Atenção";
            case CRITICO -> "Crítico";
        };
    }
}
