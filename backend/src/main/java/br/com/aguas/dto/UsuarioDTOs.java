package br.com.aguas.dto;

import br.com.aguas.entity.Perfil;
import br.com.aguas.entity.Usuario;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Contratos de usuário e autenticação. Os nomes de campo seguem src/services/tipos.ts do front. */
public final class UsuarioDTOs {

    private UsuarioDTOs() {}

    /** "usuario" no front corresponde à coluna usuario.login. */
    public record UsuarioDTO(Integer id, String nome, String usuario, Perfil perfil, boolean ativo) {
        public static UsuarioDTO de(Usuario u) {
            return new UsuarioDTO(u.getId(), u.getNome(), u.getLogin(), u.getPerfil(), u.isAtivo());
        }
    }

    public record NovoUsuarioDTO(
            @NotBlank(message = "Informe o nome completo.")
            @Size(max = 120, message = "O nome pode ter no máximo 120 caracteres.")
            String nome,
            @NotBlank(message = "Informe o nome de usuário.")
            @Pattern(regexp = "^[a-z0-9._-]{3,60}$",
                    message = "Use de 3 a 60 caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado.")
            String usuario,
            @NotNull(message = "Escolha o perfil.")
            Perfil perfil,
            @NotNull(message = "Crie uma senha.")
            @Size(min = 8, max = 72, message = "A senha precisa ter entre 8 e 72 caracteres.")
            String senha) {}

    /** Atualização da própria conta (tela Configurações). Para trocar a senha, senhaAtual é obrigatória. */
    public record AtualizarUsuarioDTO(
            @Size(max = 120, message = "O nome pode ter no máximo 120 caracteres.")
            String nome,
            @Size(min = 8, max = 72, message = "A senha precisa ter entre 8 e 72 caracteres.")
            String senha,
            String senhaAtual) {}

    /** Administrador define uma nova senha para outra pessoa (quem esqueceu a própria). */
    public record RedefinirSenhaDTO(
            @NotNull(message = "Crie a nova senha.")
            @Size(min = 8, max = 72, message = "A senha precisa ter entre 8 e 72 caracteres.")
            String senha) {}

    public record AtivoDTO(@NotNull(message = "Informe se o acesso fica ativo.") Boolean ativo) {}

    public record LoginDTO(
            @NotBlank(message = "Informe o usuário.") String usuario,
            @NotBlank(message = "Informe a senha.") String senha) {}

    public record SessaoDTO(String token, UsuarioDTO usuario) {}

    /** Resposta da rotação: a chave nova (64 caracteres alfanuméricos) aparece só aqui, uma única vez. */
    public record TokenDeApiDTO(String token, UsuarioDTO usuario) {}
}
