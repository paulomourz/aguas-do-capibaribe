package br.com.aguas.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.aguas.config.CacheConfig;
import br.com.aguas.dto.ProcessoDTOs.SalvarProcessoDTO;
import br.com.aguas.entity.Processo;
import br.com.aguas.entity.Unidade;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.ProcessoRepository;

/**
 * Cache da lista de processos: a segunda leitura não vai ao banco, e criar ou editar um processo (meta) remove a
 * entrada, para a próxima leitura já trazer a meta nova. Uma criação recusada não derruba o cache.
 */
@SpringJUnitConfig(classes = { CacheConfig.class, ProcessoService.class })
class ProcessoServiceCacheTest {

    @Autowired ProcessoService servico;
    @Autowired CacheManager caches;

    @MockitoBean ProcessoRepository processos;

    private Processo estonagem;

    @BeforeEach
    void umProcessoCadastrado() {
        caches.getCache(CacheConfig.PROCESSOS).clear();
        estonagem = new Processo("Estonagem Suave", Unidade.peca, new BigDecimal("12.00"));
        ReflectionTestUtils.setField(estonagem, "id", 1);
        when(processos.findAll(any(Sort.class))).thenAnswer(i -> List.of(estonagem));
        when(processos.findById(1)).thenReturn(Optional.of(estonagem));
        when(processos.save(any(Processo.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void segundaLeituraVemDoCache() {
        servico.listar();
        servico.listar();
        verify(processos, times(1)).findAll(any(Sort.class));
    }

    @Test
    void editarAMetaInvalidaOCacheEAProximaLeituraTrazAMetaNova() {
        assertEquals(new BigDecimal("12.00"), servico.listar().getFirst().meta());

        servico.atualizar(1, new SalvarProcessoDTO("Estonagem Suave", Unidade.peca, new BigDecimal("9.75")));

        assertEquals(new BigDecimal("9.75"), servico.listar().getFirst().meta());
        verify(processos, times(2)).findAll(any(Sort.class));
    }

    @Test
    void criarProcessoInvalidaOCache() {
        servico.listar();
        servico.criar(new SalvarProcessoDTO("Tingimento", Unidade.lote, new BigDecimal("300")));
        servico.listar();
        verify(processos, times(2)).findAll(any(Sort.class));
    }

    @Test
    void criacaoRecusadaPorNomeRepetidoNaoInvalidaOCache() {
        servico.listar();
        clearInvocations(processos);
        when(processos.existsByNomeIgnoreCase("Estonagem Suave")).thenReturn(true);

        assertThrows(ApiException.class,
                () -> servico.criar(new SalvarProcessoDTO("Estonagem Suave", Unidade.peca, BigDecimal.TEN)));

        servico.listar();
        verify(processos, times(0)).findAll(any(Sort.class));
    }
}
