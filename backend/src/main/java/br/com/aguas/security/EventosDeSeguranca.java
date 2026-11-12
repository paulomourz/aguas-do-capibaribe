package br.com.aguas.security;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import br.com.aguas.dto.AuditoriaDTOs.BloqueioDTO;
import br.com.aguas.dto.AuditoriaDTOs.SegurancaDTO;
import br.com.aguas.service.Privacidade;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * Eventos de segurança para o painel do administrador (issue #109), sem tabela no banco: contadores do Micrometer,
 * que também aparecem em /api/actuator/metrics, e os bloqueios por limite mais recentes, em memória.
 * Tudo zera quando a API reinicia; o campo "desde" da resposta diz a partir de quando os números valem.
 * Nenhuma senha é guardada, e o IP fica mascarado (LGPD, RNF27).
 */
@Component
public class EventosDeSeguranca {

    /** Quantos pares (rota, IP) de bloqueio ficam guardados; o mais antigo sai quando passa disso. */
    static final int MAX_BLOQUEIOS = 100;

    public static final String ROTA_LOGIN = "login";
    public static final String ROTA_LOTES = "lotes";

    private final Clock relogio;
    private final Instant desde;
    private final Counter loginSucesso;
    private final Counter loginFalha;
    private final Counter limiteLogin;
    private final Counter limiteLotes;
    private final Counter senhaTrocada;
    private final Counter senhaRedefinida;

    /** Chave "rota|ip mascarado", na ordem do último bloqueio (o mais recente no fim). */
    private final Map<String, Bloqueio> bloqueios = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Bloqueio> maisAntigo) {
            return size() > MAX_BLOQUEIOS;
        }
    };

    @Autowired
    public EventosDeSeguranca(ObjectProvider<MeterRegistry> registros) {
        this(registros.getIfAvailable(SimpleMeterRegistry::new), Clock.systemUTC());
    }

    /** Para testes de unidade que só precisam de um EventosDeSeguranca qualquer. */
    public static EventosDeSeguranca paraTeste() {
        return new EventosDeSeguranca(new SimpleMeterRegistry(), Clock.systemUTC());
    }

    EventosDeSeguranca(MeterRegistry registro, Clock relogio) {
        this.relogio = relogio;
        this.desde = relogio.instant();
        this.loginSucesso = contador(registro, "aguas.seguranca.login", "resultado", "sucesso", "Logins aceitos");
        this.loginFalha = contador(registro, "aguas.seguranca.login", "resultado", "falha",
                "Logins recusados (usuário inexistente, senha errada ou acesso desativado)");
        this.limiteLogin = contador(registro, "aguas.seguranca.limite", "rota", ROTA_LOGIN, "Requisições bloqueadas pelo limite (429)");
        this.limiteLotes = contador(registro, "aguas.seguranca.limite", "rota", ROTA_LOTES, "Requisições bloqueadas pelo limite (429)");
        this.senhaTrocada = contador(registro, "aguas.seguranca.senha", "tipo", "troca_propria", "Trocas de senha");
        this.senhaRedefinida = contador(registro, "aguas.seguranca.senha", "tipo", "redefinicao", "Trocas de senha");
    }

    private static Counter contador(MeterRegistry registro, String nome, String tag, String valor, String descricao) {
        return Counter.builder(nome).tag(tag, valor).description(descricao).register(registro);
    }

    public void loginAceito() {
        loginSucesso.increment();
    }

    public void loginRecusado() {
        loginFalha.increment();
    }

    public void senhaTrocadaPeloProprio() {
        senhaTrocada.increment();
    }

    public void senhaRedefinidaPeloAdmin() {
        senhaRedefinida.increment();
    }

    /** Uma requisição respondida com 429. Repetições do mesmo IP na mesma rota somam na mesma linha. */
    public void bloqueio(String rota, String ip) {
        (ROTA_LOGIN.equals(rota) ? limiteLogin : limiteLotes).increment();
        Instant agora = relogio.instant();
        String ipMascarado = Privacidade.mascararIp(ip);
        synchronized (bloqueios) {
            Bloqueio b = bloqueios.get(rota + "|" + ipMascarado);
            if (b == null) {
                bloqueios.put(rota + "|" + ipMascarado, new Bloqueio(rota, ipMascarado, agora));
            } else {
                b.repetir(agora);
            }
        }
    }

    public SegurancaDTO resumo() {
        List<BloqueioDTO> lista = new ArrayList<>();
        synchronized (bloqueios) {
            for (Bloqueio b : bloqueios.values()) {
                lista.add(new BloqueioDTO(b.rota, b.ip, b.primeiro, b.ultimo, b.tentativas));
            }
        }
        lista.sort(Comparator.comparing(BloqueioDTO::ultimo).reversed());
        return new SegurancaDTO(desde, qtd(loginSucesso), qtd(loginFalha), qtd(limiteLogin), qtd(limiteLotes),
                qtd(senhaTrocada), qtd(senhaRedefinida), lista);
    }

    private static long qtd(Counter c) {
        return (long) c.count();
    }

    private static final class Bloqueio {
        final String rota;
        final String ip;
        final Instant primeiro;
        Instant ultimo;
        long tentativas = 1;

        Bloqueio(String rota, String ip, Instant agora) {
            this.rota = rota;
            this.ip = ip;
            this.primeiro = agora;
            this.ultimo = agora;
        }

        void repetir(Instant agora) {
            ultimo = agora;
            tentativas++;
        }
    }
}
