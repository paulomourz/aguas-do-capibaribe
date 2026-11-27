package br.com.aguas.monitoramento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.endpoint.SecurityContext;
import org.springframework.boot.actuate.health.AdditionalHealthEndpointPath;
import org.springframework.boot.actuate.health.HealthEndpointGroup;
import org.springframework.boot.actuate.health.HealthEndpointGroups;
import org.springframework.boot.actuate.health.HttpCodeStatusMapper;
import org.springframework.boot.actuate.health.StatusAggregator;

/** Issue #158: o sensorWokwi sai só da raiz; os outros componentes e o grupo "sensor" ficam como estavam. */
class SaudeDoSensorForaDaRaizTest {

    private final HealthEndpointGroup principal = mock(HealthEndpointGroup.class);
    private final HealthEndpointGroup sensor = mock(HealthEndpointGroup.class);

    private final HealthEndpointGroups grupos = new SaudeDoSensorForaDaRaiz()
            .postProcessHealthEndpointGroups(HealthEndpointGroups.of(principal, Map.of("sensor", sensor)));

    @Test
    void raizNaoIncluiOSensorMasMantemOsDemais() {
        when(principal.isMember("sensorWokwi")).thenReturn(true);
        when(principal.isMember("db")).thenReturn(true);
        when(principal.isMember("diskSpace")).thenReturn(false);

        HealthEndpointGroup raiz = grupos.getPrimary();

        assertThat(raiz.isMember("sensorWokwi")).isFalse();
        assertThat(raiz.isMember("db")).isTrue();
        assertThat(raiz.isMember("diskSpace")).isFalse();
    }

    @Test
    void grupoDoSensorContinuaIgual() {
        assertThat(grupos.getNames()).containsExactly("sensor");
        assertThat(grupos.get("sensor")).isSameAs(sensor);
    }

    @Test
    void raizMantemQuemVeDetalhes() {
        SecurityContext admin = mock(SecurityContext.class);
        when(principal.showDetails(admin)).thenReturn(true);
        when(principal.showComponents(admin)).thenReturn(true);

        assertThat(grupos.getPrimary().showDetails(admin)).isTrue();
        assertThat(grupos.getPrimary().showComponents(admin)).isTrue();
        assertThat(grupos.getPrimary().showDetails(SecurityContext.NONE)).isFalse();
    }

    @Test
    void raizMantemOStatusGeralOCodigoHttpEOCaminhoExtra() {
        StatusAggregator agregador = StatusAggregator.getDefault();
        HttpCodeStatusMapper mapeador = HttpCodeStatusMapper.DEFAULT;
        AdditionalHealthEndpointPath caminho = AdditionalHealthEndpointPath.from("server:/saude");
        when(principal.getStatusAggregator()).thenReturn(agregador);
        when(principal.getHttpCodeStatusMapper()).thenReturn(mapeador);
        when(principal.getAdditionalPath()).thenReturn(caminho);

        HealthEndpointGroup raiz = grupos.getPrimary();

        assertThat(raiz.getStatusAggregator()).isSameAs(agregador);
        assertThat(raiz.getHttpCodeStatusMapper()).isSameAs(mapeador);
        assertThat(raiz.getAdditionalPath()).isSameAs(caminho);
    }
}
