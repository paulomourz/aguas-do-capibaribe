package br.com.aguas.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import br.com.aguas.entity.StatusAlerta;
import br.com.aguas.service.RegraDeAlerta.Anexar;
import br.com.aguas.service.RegraDeAlerta.Criar;
import br.com.aguas.service.RegraDeAlerta.LoteAvaliado;
import br.com.aguas.service.RegraDeAlerta.Nenhuma;

class RegraDeAlertaTest {

    private static LoteAvaliado acima(int id) { return new LoteAvaliado(id, true, null, null); }
    private static LoteAvaliado abaixo(int id) { return new LoteAvaliado(id, false, null, null); }
    private static LoteAvaliado acimaEmAlerta(int id, int alerta, StatusAlerta s) { return new LoteAvaliado(id, true, alerta, s); }

    @Test
    void loteNoLimiteOuAbaixoNaoGeraNada() {
        assertThat(RegraDeAlerta.decidir(List.of(abaixo(3), acima(2), acima(1)))).isInstanceOf(Nenhuma.class);
    }

    @Test
    void menosDeTresLotesAcimaNaoGeraAlerta() {
        assertThat(RegraDeAlerta.decidir(List.of(acima(2), acima(1)))).isInstanceOf(Nenhuma.class);
        assertThat(RegraDeAlerta.decidir(List.of(acima(3), acima(2), abaixo(1)))).isInstanceOf(Nenhuma.class);
    }

    @Test
    void tresConsecutivosAcimaSemAlertaCriamAlertaDoMaisAntigoAoMaisRecente() {
        var d = RegraDeAlerta.decidir(List.of(acima(30), acima(20), acima(10)));
        assertThat(d).isEqualTo(new Criar(List.of(10, 20, 30)));
    }

    @Test
    void sequenciaQueContinuaEntraNoAlertaAberto() {
        var d = RegraDeAlerta.decidir(List.of(acima(4), acimaEmAlerta(3, 7, StatusAlerta.aberto), acimaEmAlerta(2, 7, StatusAlerta.aberto)));
        assertThat(d).isEqualTo(new Anexar(7));
    }

    @Test
    void sequenciaQueContinuaEntraNoAlertaEmAnalise() {
        var d = RegraDeAlerta.decidir(List.of(acima(4), acimaEmAlerta(3, 7, StatusAlerta.analise)));
        assertThat(d).isEqualTo(new Anexar(7));
    }

    @Test
    void lotesDeAlertaResolvidoNaoSaoReaproveitados() {
        var d = RegraDeAlerta.decidir(List.of(acima(4), acimaEmAlerta(3, 7, StatusAlerta.resolvido), acimaEmAlerta(2, 7, StatusAlerta.resolvido)));
        assertThat(d).isInstanceOf(Nenhuma.class);
        var d2 = RegraDeAlerta.decidir(List.of(acima(5), acima(4), acimaEmAlerta(3, 7, StatusAlerta.resolvido)));
        assertThat(d2).isInstanceOf(Nenhuma.class);
        var d3 = RegraDeAlerta.decidir(List.of(acima(6), acima(5), acima(4)));
        assertThat(d3).isEqualTo(new Criar(List.of(4, 5, 6)));
    }
}
