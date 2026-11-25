package br.com.aguas.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.dto.PrecoM3DTOs.NovoPrecoM3DTO;
import br.com.aguas.dto.PrecoM3DTOs.PrecoM3DTO;
import br.com.aguas.entity.PrecoM3;
import br.com.aguas.entity.Usuario;
import br.com.aguas.repository.PrecoM3Repository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.UsuarioAutenticado;

/** Histórico do preço do m³: só cresce, nunca muda. */
@Service
public class PrecoM3Service {

    /** Por vigência e, na mesma vigência, por cadastro: o último de cada data é o que vale. */
    private static final Comparator<PrecoM3> ORDEM = Comparator.comparing(PrecoM3::getVigencia)
            .thenComparing(PrecoM3::getCadastradoEm)
            .thenComparing(PrecoM3::getId);

    private final PrecoM3Repository precos;
    private final UsuarioRepository usuarios;

    public PrecoM3Service(PrecoM3Repository precos, UsuarioRepository usuarios) {
        this.precos = precos;
        this.usuarios = usuarios;
    }

    /** shortcut: ordena em memória o histórico inteiro; se passar de alguns milhares de preços, paginar no banco. */
    @Transactional(readOnly = true)
    public List<PrecoM3DTO> listar() {
        List<PrecoM3> todos = precos.findAll().stream().sorted(ORDEM).toList();
        Map<Integer, Usuario> pessoas = usuarios.findAllById(todos.stream().map(PrecoM3::getUsuarioId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Usuario::getId, Function.identity()));
        return todos.stream().map(p -> dto(p, pessoas.get(p.getUsuarioId()))).toList();
    }

    @Transactional
    public PrecoM3DTO cadastrar(UsuarioAutenticado quem, NovoPrecoM3DTO dados) {
        PrecoM3 p = precos.save(new PrecoM3(dados.valor(), dados.vigencia(), quem.id()));
        return dto(p, usuarios.findById(quem.id()).orElseThrow());
    }

    /** Quem cadastrou sempre existe: usuário não é excluído (só desativado) e a FK usuario_id impede. */
    private static PrecoM3DTO dto(PrecoM3 p, Usuario u) {
        return new PrecoM3DTO(p.getId(), p.getValor(), p.getVigencia(), u.getNome(), p.getCadastradoEm().toInstant());
    }
}
