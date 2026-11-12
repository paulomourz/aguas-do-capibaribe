package br.com.aguas.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

import br.com.aguas.dto.AuditoriaDTOs.BloqueioDTO;
import br.com.aguas.dto.AuditoriaDTOs.SegurancaDTO;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/** Contadores e bloqueios do painel de segurança do administrador (issue #109). */
class EventosDeSegurancaTest {

    private final AtomicReference<Instant> agora = new AtomicReference<>(Instant.parse("2026-11-11T12:00:00Z"));
    private final Clock relogio = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zona) { return this; }
        @Override public Instant instant() { return agora.get(); }
    };
    private final SimpleMeterRegistry registro = new SimpleMeterRegistry();
    private final EventosDeSeguranca eventos = new EventosDeSeguranca(registro, relogio);

    @Test
    void contaLoginsESenhasDesdeOInicio() {
        eventos.loginAceito();
        eventos.loginRecusado();
        eventos.loginRecusado();
        eventos.senhaTrocadaPeloProprio();
        eventos.senhaRedefinidaPeloAdmin();

        SegurancaDTO r = eventos.resumo();
        assertThat(r.desde()).isEqualTo(Instant.parse("2026-11-11T12:00:00Z"));
        assertThat(r.loginsAceitos()).isEqualTo(1);
        assertThat(r.loginsRecusados()).isEqualTo(2);
        assertThat(r.senhasTrocadas()).isEqualTo(1);
        assertThat(r.senhasRedefinidas()).isEqualTo(1);
        assertThat(r.bloqueios()).isEmpty();
    }

    @Test
    void contadoresAparecemNasMetricasDoActuator() {
        eventos.loginRecusado();
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOTES, "10.0.0.1");

        assertThat(registro.get("aguas.seguranca.login").tag("resultado", "falha").counter().count()).isEqualTo(1);
        assertThat(registro.get("aguas.seguranca.limite").tag("rota", "lotes").counter().count()).isEqualTo(1);
        assertThat(registro.get("aguas.seguranca.senha").tag("tipo", "redefinicao").counter().count()).isZero();
    }

    @Test
    void bloqueiosDoMesmoIpNaMesmaRotaSomamNaMesmaLinha() {
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOGIN, "200.17.33.45");
        agora.set(Instant.parse("2026-11-11T12:00:30Z"));
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOGIN, "200.17.33.99");  // mesma rede: mesmo IP mascarado
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOTES, "200.17.33.45");

        SegurancaDTO r = eventos.resumo();
        assertThat(r.bloqueiosLogin()).isEqualTo(2);
        assertThat(r.bloqueiosLotes()).isEqualTo(1);
        assertThat(r.bloqueios()).hasSize(2);
        BloqueioDTO login = r.bloqueios().stream().filter(b -> b.rota().equals("login")).findFirst().orElseThrow();
        assertThat(login.ip()).isEqualTo("200.17.33.***");
        assertThat(login.tentativas()).isEqualTo(2);
        assertThat(login.primeiro()).isEqualTo(Instant.parse("2026-11-11T12:00:00Z"));
        assertThat(login.ultimo()).isEqualTo(Instant.parse("2026-11-11T12:00:30Z"));
    }

    @Test
    void bloqueioMaisRecenteVemPrimeiro() {
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOGIN, "10.0.1.1");
        agora.set(Instant.parse("2026-11-11T12:01:00Z"));
        eventos.bloqueio(EventosDeSeguranca.ROTA_LOGIN, "10.0.2.1");

        assertThat(eventos.resumo().bloqueios()).extracting(BloqueioDTO::ip).containsExactly("10.0.2.***", "10.0.1.***");
    }

    @Test
    void guardaNoMaximoCemLinhasEDescartaAMaisAntiga() {
        for (int i = 0; i <= EventosDeSeguranca.MAX_BLOQUEIOS; i++) {
            agora.set(Instant.parse("2026-11-11T12:00:00Z").plusSeconds(i));
            eventos.bloqueio(EventosDeSeguranca.ROTA_LOGIN, "10." + i + ".0.1");
        }

        SegurancaDTO r = eventos.resumo();
        assertThat(r.bloqueios()).hasSize(EventosDeSeguranca.MAX_BLOQUEIOS);
        assertThat(r.bloqueios()).extracting(BloqueioDTO::ip).doesNotContain("10.0.0.***");
        assertThat(r.bloqueiosLogin()).isEqualTo(EventosDeSeguranca.MAX_BLOQUEIOS + 1);  // o contador não perde nada
    }
}
