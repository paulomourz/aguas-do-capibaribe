-- V6: novos perfis de acesso (issue #66). A conta do sensor passa a ter perfil próprio.
-- O administrador principal é promovido na inicialização da API, porque o login dele é configurável (ADMIN_LOGIN).

ALTER TABLE usuario DROP CONSTRAINT usuario_perfil_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_perfil_check
    CHECK ((perfil)::text = ANY ((ARRAY['admin'::character varying, 'gestor'::character varying,
                                        'operador'::character varying, 'sensor'::character varying])::text[]));

UPDATE usuario SET perfil = 'sensor' WHERE login = 'sensor.wokwi';
