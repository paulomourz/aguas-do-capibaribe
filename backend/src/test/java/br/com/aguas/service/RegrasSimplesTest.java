package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.Test;

import br.com.aguas.config.AppProperties;
import br.com.aguas.dto.LoteDTOs;
import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.security.JwtService;

class RegrasSimplesTest {

    @Test
    void transicoesDeStatusDoAlertaSeguemATela() {
        assertThat(StatusAlerta.aberto.podeIrPara(StatusAlerta.analise)).isTrue();
        assertThat(StatusAlerta.aberto.podeIrPara(StatusAlerta.resolvido)).isTrue();
        assertThat(StatusAlerta.analise.podeIrPara(StatusAlerta.resolvido)).isTrue();
        assertThat(StatusAlerta.analise.podeIrPara(StatusAlerta.aberto)).isFalse();
        assertThat(StatusAlerta.resolvido.podeIrPara(StatusAlerta.aberto)).isFalse();
        assertThat(StatusAlerta.resolvido.podeIrPara(StatusAlerta.analise)).isFalse();
        assertThat(StatusAlerta.aberto.podeIrPara(StatusAlerta.aberto)).isFalse();
    }

    @Test
    void desvioUsaAMesmaFormulaDaView() {
        assertThat(LoteDTOs.calcularDesvio(new BigDecimal("1290.00"), new BigDecimal("1200.00"))).isEqualByComparingTo("7.50");
        assertThat(LoteDTOs.calcularDesvio(new BigDecimal("760.00"), new BigDecimal("800.00"))).isEqualByComparingTo("-5.00");
        assertThat(LoteDTOs.calcularDesvio(new BigDecimal("1000.00"), new BigDecimal("3.00"))).isEqualByComparingTo("33233.33");
    }

    @Test
    void corsRecusaCuringa() {
        var props = new AppProperties(null, "http://localhost:8443, *", null);
        assertThatThrownBy(props::origensCors).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void corsAceitaListaExplicita() {
        var props = new AppProperties(null, " http://localhost:8443/ ,https://app.exemplo.com.br", null);
        assertThat(props.origensCors()).containsExactly("http://localhost:8443", "https://app.exemplo.com.br");
        assertThat(new AppProperties(null, "", null).origensCors()).isEmpty();
    }

    @Test
    void fusoPadraoDosRelatoriosERecife() {
        assertThat(new AppProperties(null, null, null).zonaRelatorios().getId()).isEqualTo("America/Recife");
    }

    @Test
    void jwtExigeSegredoDePeloMenos32Caracteres() {
        var curto = new AppProperties(new AppProperties.Jwt("curto", Duration.ofHours(8)), null, null);
        assertThatThrownBy(() -> new JwtService(curto)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void jwtGeradoEValidoComOitoHoras() {
        var props = new AppProperties(new AppProperties.Jwt("segredo-de-teste-com-mais-de-32-caracteres", Duration.ofHours(8)), null, null);
        var jwt = new JwtService(props);
        var decodificado = jwt.decoder().decode(jwt.gerar(42));
        assertThat(decodificado.getSubject()).isEqualTo("42");
        assertThat(Duration.between(decodificado.getIssuedAt(), decodificado.getExpiresAt())).isEqualTo(Duration.ofHours(8));
    }
}
