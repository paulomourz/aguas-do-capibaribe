package br.com.aguas.service;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.aguas.config.AdminProperties;
import br.com.aguas.dto.UsuarioDTOs.AtualizarUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.NovoUsuarioDTO;
import br.com.aguas.dto.UsuarioDTOs.UsuarioDTO;
import br.com.aguas.entity.AcaoAuditoria;
import br.com.aguas.entity.AuditoriaUsuario;
import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import br.com.aguas.exception.ApiException;
import br.com.aguas.repository.AuditoriaUsuarioRepository;
import br.com.aguas.repository.UsuarioRepository;
import br.com.aguas.security.UsuarioAutenticado;

@Service
public class UsuarioService {

    private static final Logger log = LoggerFactory.getLogger(UsuarioService.class);

    /** Limite do BCrypt: bytes além de 72 seriam ignorados. */
    private static final int MAX_BYTES_SENHA = 72;

    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final AdminProperties admin;
    private final AuditoriaUsuarioRepository auditoria;

    public UsuarioService(UsuarioRepository usuarios, PasswordEncoder senhas, AdminProperties admin,
                          AuditoriaUsuarioRepository auditoria) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.admin = admin;
        this.auditoria = auditoria;
    }

    /**
     * O administrador recebe os logins inteiros (cria e cuida das contas). O gestor usa a lista só para mostrar
     * quem registrou cada lote: recebe os nomes inteiros e os logins dos outros mascarados (LGPD, RNF27).
     */
    @Transactional(readOnly = true)
    public List<UsuarioDTO> listar(UsuarioAutenticado quem) {
        List<UsuarioDTO> todos = usuarios.findAll(Sort.by("id")).stream().map(UsuarioDTO::de).toList();
        if (quem.perfil() == Perfil.admin) return todos;
        return todos.stream()
                .map(u -> u.id().equals(quem.id()) ? u
                        : new UsuarioDTO(u.id(), u.nome(), Privacidade.mascararLogin(u.usuario()), u.perfil(), u.ativo()))
                .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioDTO buscar(Integer id) {
        return usuarios.findById(id).map(UsuarioDTO::de)
                .orElseThrow(() -> ApiException.naoEncontrado("Usuário não encontrado."));
    }

    @Transactional
    public UsuarioDTO criar(UsuarioAutenticado quem, NovoUsuarioDTO dados) {
        String login = dados.usuario().trim().toLowerCase();
        if (usuarios.existsByLoginIgnoreCase(login)) {
            throw ApiException.conflito("USUARIO_DUPLICADO", "Este usuário já existe. Escolha outro.", "usuario");
        }
        checarBytes("senha", dados.senha());
        Usuario u = new Usuario(dados.nome().trim(), login, senhas.encode(dados.senha()), dados.perfil());
        Usuario criado = usuarios.save(u);
        auditar(quem, criado, AcaoAuditoria.CRIACAO_USUARIO);
        return UsuarioDTO.de(criado);
    }

    /** Cada pessoa altera apenas a própria conta (tela Configurações). */
    @Transactional
    public UsuarioDTO atualizar(UsuarioAutenticado quem, Integer id, AtualizarUsuarioDTO dados) {
        if (!quem.id().equals(id)) throw ApiException.proibido("Você só pode alterar a própria conta.");
        Usuario u = usuarios.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Usuário não encontrado."));

        if (dados.nome() == null && dados.senha() == null) {
            throw ApiException.validacao("nome", "Informe o nome ou a nova senha.");
        }
        if (dados.nome() != null) {
            if (dados.nome().isBlank()) throw ApiException.validacao("nome", "Informe o nome completo.");
            u.setNome(dados.nome().trim());
        }
        if (dados.senha() != null) {
            if (dados.senhaAtual() == null || dados.senhaAtual().isEmpty()) {
                throw ApiException.validacao("senhaAtual", "Informe a senha atual.");
            }
            if (!senhas.matches(dados.senhaAtual(), u.getSenhaHash())) {
                throw ApiException.validacao("senhaAtual", "A senha atual está incorreta.");
            }
            if (dados.senha().equals(dados.senhaAtual())) {
                throw ApiException.validacao("senha", "A nova senha precisa ser diferente da atual.");
            }
            checarBytes("senha", dados.senha());
            u.setSenhaHash(senhas.encode(dados.senha()));
        }
        usuarios.flush();
        return UsuarioDTO.de(u);
    }

    /**
     * O administrador redefine a senha de outra pessoa que a esqueceu. A própria senha se troca em
     * Configurações (com a senha atual), e a do administrador principal só ele mesmo troca.
     */
    @Transactional
    public UsuarioDTO redefinirSenha(UsuarioAutenticado quem, Integer id, String novaSenha) {
        if (quem.id().equals(id)) {
            throw new ApiException(HttpStatus.CONFLICT, "OPERACAO_NAO_PERMITIDA",
                    "Para trocar a sua própria senha, use a tela Configurações.", null);
        }
        Usuario u = usuarios.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Usuário não encontrado."));
        if (admin.ehAdmin(u.getLogin())) {
            throw new ApiException(HttpStatus.CONFLICT, "OPERACAO_NAO_PERMITIDA",
                    "A senha do administrador principal só pode ser trocada por ele.", null);
        }
        checarBytes("senha", novaSenha);
        u.setSenhaHash(senhas.encode(novaSenha));
        usuarios.flush();
        auditar(quem, u, AcaoAuditoria.REDEFINICAO_SENHA);
        return UsuarioDTO.de(u);
    }

    @Transactional
    public UsuarioDTO definirAtivo(UsuarioAutenticado quem, Integer id, boolean ativo) {
        if (quem.id().equals(id)) {
            throw new ApiException(HttpStatus.CONFLICT, "OPERACAO_NAO_PERMITIDA",
                    "Você não pode desativar ou reativar a própria conta.", null);
        }
        Usuario u = usuarios.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Usuário não encontrado."));
        if (admin.ehAdmin(u.getLogin())) {
            throw new ApiException(HttpStatus.CONFLICT, "OPERACAO_NAO_PERMITIDA",
                    "O administrador principal não pode ser desativado.", null);
        }
        u.setAtivo(ativo);
        usuarios.flush();
        auditar(quem, u, ativo ? AcaoAuditoria.REATIVACAO_USUARIO : AcaoAuditoria.DESATIVACAO_USUARIO);
        return UsuarioDTO.de(u);
    }

    /**
     * Registra a ação na mesma transação da mudança: se uma falhar, as duas são desfeitas.
     * Só ids e o tipo da ação; senha e hash nunca entram na auditoria nem no log.
     */
    private void auditar(UsuarioAutenticado quem, Usuario afetado, AcaoAuditoria acao) {
        auditoria.saveAndFlush(new AuditoriaUsuario(quem.id(), afetado.getId(), acao));
        log.info("Auditoria: {} por usuario id={} no usuario id={}", acao, quem.id(), afetado.getId());
    }

    private static void checarBytes(String campo, String senha) {
        if (senha.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES_SENHA) {
            throw ApiException.validacao(campo, "A senha é longa demais. Use menos caracteres ou evite acentos e símbolos.");
        }
    }
}
