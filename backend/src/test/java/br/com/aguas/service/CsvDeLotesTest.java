package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

import br.com.aguas.dto.LoteCsvDTO;
import br.com.aguas.entity.StatusConformidade;

/** Formato do CSV da API: o mesmo do CSV do Histórico no site (historicoCsv.test.ts). */
class CsvDeLotesTest {

    private static final ZoneId RECIFE = ZoneId.of("America/Recife");

    @Test
    void cabecalhoIgualAoDoSite() {
        assertThat(CsvDeLotes.linhaDeCabecalho()).isEqualTo(
                "ID do lote;Data;Hora;Data e hora (UTC);Processo;Peças;Consumo real (L);Consumo esperado (L);"
                        + "Diferença (L);Desvio (%);Status;Registrado por\r\n");
    }

    @Test
    void linhaComDataDeRecifeEUtcNumerosComVirgulaEStatus() {
        // 01/09/2026 02:30:15,123456 UTC = 31/08/2026 23:30:15 em Recife
        var l = new LoteCsvDTO(42, OffsetDateTime.parse("2026-09-01T02:30:15.123456Z"), 1, 2, 100,
                new BigDecimal("1080"), new BigDecimal("1000.00"));
        assertThat(CsvDeLotes.linha(l, "Estonagem", "Maria", RECIFE)).isEqualTo(
                "42;31/08/2026;23:30:15;2026-09-01T02:30:15Z;Estonagem;100;1080,00;1000,00;80,00;8,00;Atenção;Maria\r\n");
    }

    @Test
    void numerosSemMilharNemNotacaoCientifica() {
        assertThat(CsvDeLotes.numero(new BigDecimal("1234567.5"))).isEqualTo("1234567,50");
        assertThat(CsvDeLotes.numero(new BigDecimal("1E+3"))).isEqualTo("1000,00");
        assertThat(CsvDeLotes.numero(new BigDecimal("-12.345"))).isEqualTo("-12,35");
        assertThat(CsvDeLotes.numero(new BigDecimal("0.004"))).isEqualTo("0,00");
    }

    @Test
    void textoDigitadoNaoViraFormulaNemQuebraAsColunas() {
        assertThat(CsvDeLotes.texto("=SOMA(A1)")).isEqualTo("'=SOMA(A1)");
        assertThat(CsvDeLotes.texto("+55 81")).isEqualTo("'+55 81");
        assertThat(CsvDeLotes.texto("-x")).isEqualTo("'-x");
        assertThat(CsvDeLotes.texto("@cmd")).isEqualTo("'@cmd");
        assertThat(CsvDeLotes.texto("Lavagem; enxágue")).isEqualTo("\"Lavagem; enxágue\"");
        assertThat(CsvDeLotes.texto("Jeans \"skinny\"")).isEqualTo("\"Jeans \"\"skinny\"\"\"");
        assertThat(CsvDeLotes.texto("Ana Lúcia")).isEqualTo("Ana Lúcia");
    }

    @Test
    void rotulosIguaisAosDaTela() {
        assertThat(CsvDeLotes.rotulo(StatusConformidade.DENTRO_DA_META)).isEqualTo("Dentro da meta");
        assertThat(CsvDeLotes.rotulo(StatusConformidade.ATENCAO)).isEqualTo("Atenção");
        assertThat(CsvDeLotes.rotulo(StatusConformidade.CRITICO)).isEqualTo("Crítico");
    }
}
