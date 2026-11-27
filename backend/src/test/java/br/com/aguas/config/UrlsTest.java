package br.com.aguas.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UrlsTest {

    @Test
    void tiraSoAsBarrasDoFim() {
        assertThat(Urls.semBarraNoFim("https://site.com/")).isEqualTo("https://site.com");
        assertThat(Urls.semBarraNoFim("https://site.com/app///")).isEqualTo("https://site.com/app");
        assertThat(Urls.semBarraNoFim("https://site.com/app")).isEqualTo("https://site.com/app");
        assertThat(Urls.semBarraNoFim("///")).isEmpty();
        assertThat(Urls.semBarraNoFim("")).isEmpty();
        assertThat(Urls.semBarraNoFim(null)).isNull();
    }
}
