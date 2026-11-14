package br.com.aguas.security;

import br.com.aguas.entity.Perfil;

/** Usuário da requisição atual, carregado do banco a cada chamada autenticada. */
public record UsuarioAutenticado(Integer id, Perfil perfil) {

    /** O administrador faz tudo que o gestor faz, além de cuidar de usuários e da auditoria. */
    public boolean gestor() {
        return perfil == Perfil.gestor || perfil == Perfil.admin;
    }
}
