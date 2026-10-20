package br.com.aguas.security;

import br.com.aguas.entity.Perfil;

/** Usuário da requisição atual, carregado do banco a cada chamada autenticada. */
public record UsuarioAutenticado(Integer id, Perfil perfil) {

    public boolean gestor() {
        return perfil == Perfil.gestor;
    }
}
