package br.com.aguas.monitoramento;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.boot.actuate.endpoint.SecurityContext;
import org.springframework.boot.actuate.health.AdditionalHealthEndpointPath;
import org.springframework.boot.actuate.health.HealthEndpointGroup;
import org.springframework.boot.actuate.health.HealthEndpointGroups;
import org.springframework.boot.actuate.health.HealthEndpointGroupsPostProcessor;
import org.springframework.boot.actuate.health.HttpCodeStatusMapper;
import org.springframework.boot.actuate.health.StatusAggregator;
import org.springframework.stereotype.Component;

/**
 * Tira o componente sensorWokwi do /actuator/health raiz (issue #158).
 *
 * <p>A raiz é a checagem de vida da API: o Render e o healthcheck do Docker (backend/docker/Saude.java) reiniciam a
 * API quando ela responde 503. Se o sensor parado entrasse nessa conta, a API seria reiniciada sem ter problema
 * nenhum, e o sensor continuaria parado. O Spring Boot não tem propriedade para excluir um indicador da raiz, então
 * este pós-processador envolve o grupo principal e responde "não é membro" só para o sensorWokwi.
 *
 * <p>A saúde do sensor fica no grupo próprio /actuator/health/sensor (application.yml), com 503 quando DOWN.
 */
@Component
public class SaudeDoSensorForaDaRaiz implements HealthEndpointGroupsPostProcessor {

    static final String COMPONENTE = "sensorWokwi";

    @Override
    public HealthEndpointGroups postProcessHealthEndpointGroups(HealthEndpointGroups grupos) {
        Map<String, HealthEndpointGroup> nomeados = new LinkedHashMap<>();
        for (String nome : grupos.getNames()) nomeados.put(nome, grupos.get(nome));
        return HealthEndpointGroups.of(new SemSensor(grupos.getPrimary()), nomeados);
    }

    /** O grupo principal sem o sensorWokwi; todo o resto (detalhes, papéis, status HTTP) continua igual. */
    record SemSensor(HealthEndpointGroup principal) implements HealthEndpointGroup {

        @Override
        public boolean isMember(String nome) {
            return !COMPONENTE.equals(nome) && principal.isMember(nome);
        }

        @Override
        public boolean showComponents(SecurityContext contexto) {
            return principal.showComponents(contexto);
        }

        @Override
        public boolean showDetails(SecurityContext contexto) {
            return principal.showDetails(contexto);
        }

        @Override
        public StatusAggregator getStatusAggregator() {
            return principal.getStatusAggregator();
        }

        @Override
        public HttpCodeStatusMapper getHttpCodeStatusMapper() {
            return principal.getHttpCodeStatusMapper();
        }

        @Override
        public AdditionalHealthEndpointPath getAdditionalPath() {
            return principal.getAdditionalPath();
        }
    }
}
