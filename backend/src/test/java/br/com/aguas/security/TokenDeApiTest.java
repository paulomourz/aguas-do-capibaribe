package br.com.aguas.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

/** Formato e hash do token de API, sem banco. */
class TokenDeApiTest {

    @Test
    void chaveTem64CaracteresAlfanumericos() {
        for (int i = 0; i < 200; i++) {
            assertThat(TokenDeApi.gerar()).hasSize(64).matches("[A-Za-z0-9]{64}");
        }
    }

    @Test
    void cadaChaveEDiferenteDaAnterior() {
        Set<String> chaves = new HashSet<>();
        for (int i = 0; i < 1000; i++) chaves.add(TokenDeApi.gerar());
        assertThat(chaves).hasSize(1000);
    }

    @Test
    void hashESha256EmHexadecimalENaoRevelaAChave() {
        // Vetor conhecido do SHA-256.
        assertThat(TokenDeApi.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        String chave = TokenDeApi.gerar();
        assertThat(TokenDeApi.hash(chave)).matches("[0-9a-f]{64}").isNotEqualTo(chave).isEqualTo(TokenDeApi.hash(chave));
    }

    @Test
    void jwtEChavesDeOutroTamanhoNaoTemFormatoDeTokenDeApi() {
        assertThat(TokenDeApi.temFormato(TokenDeApi.gerar())).isTrue();
        assertThat(TokenDeApi.temFormato("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura")).isFalse();
        assertThat(TokenDeApi.temFormato("a".repeat(63))).isFalse();
        assertThat(TokenDeApi.temFormato("a".repeat(65))).isFalse();
        assertThat(TokenDeApi.temFormato("a".repeat(63) + "-")).isFalse();
        assertThat(TokenDeApi.temFormato(null)).isFalse();
    }
}
