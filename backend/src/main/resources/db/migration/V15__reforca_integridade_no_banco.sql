-- V15: regras de integridade que antes dependiam só da API ou das permissões do aguas_api.
-- Se o banco já tiver logins ou processos repetidos (diferença só de maiúsculas) ou nomes em branco, esta migração
-- falha sem aplicar nada: corrija os dados e suba a API de novo.

-- Login e nome de processo não se repetem, mesmo com maiúsculas diferentes (a API já compara assim).
CREATE UNIQUE INDEX ux_usuario_login_lower ON usuario USING btree (lower((login)::text));
CREATE UNIQUE INDEX ux_processo_nome_lower ON processo USING btree (lower((nome)::text));

-- Nome só com espaços não é nome.
ALTER TABLE usuario ADD CONSTRAINT usuario_nome_preenchido_check CHECK (btrim((nome)::text) <> '');
ALTER TABLE processo ADD CONSTRAINT processo_nome_preenchido_check CHECK (btrim((nome)::text) <> '');

-- Usuário não se exclui: quem sai da empresa é desativado e o histórico continua apontando para ele.
CREATE FUNCTION bloquear_exclusao_usuario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Usuário não pode ser excluído; desative o acesso.';
END;
$$;

CREATE TRIGGER trg_usuario_nao_exclui BEFORE DELETE ON usuario
    FOR EACH ROW EXECUTE FUNCTION bloquear_exclusao_usuario();

-- O lote recebe a hora do registro; 5 minutos de folga cobrem a diferença de relógio entre os servidores.
CREATE FUNCTION validar_data_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.registrado_em > now() + interval '5 minutes' THEN
        RAISE EXCEPTION 'Lote não pode ter data futura.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lote_data_valida BEFORE INSERT ON lote
    FOR EACH ROW EXECUTE FUNCTION validar_data_lote();

-- O alerta só reúne lotes do próprio processo.
CREATE FUNCTION validar_processo_alerta_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM lote l
        JOIN alerta a ON a.processo_id = l.processo_id
        WHERE l.id = NEW.lote_id AND a.id = NEW.alerta_id
    ) THEN
        RAISE EXCEPTION 'O lote e o alerta precisam ser do mesmo processo.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alerta_lote_processo BEFORE INSERT OR UPDATE ON alerta_lote
    FOR EACH ROW EXECUTE FUNCTION validar_processo_alerta_lote();

-- Todo alerta nasce com pelo menos um lote. A conferência fica para o fim da transação porque a API grava o alerta
-- primeiro e os lotes dele logo depois.
CREATE FUNCTION validar_alerta_com_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM alerta_lote WHERE alerta_id = NEW.id) THEN
        RAISE EXCEPTION 'Alerta precisa ter pelo menos um lote.';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_alerta_com_lote AFTER INSERT ON alerta
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION validar_alerta_com_lote();

-- Caminho do status: aberto -> analise -> resolvido, ou aberto -> resolvido. Resolvido é final.
CREATE FUNCTION validar_transicao_alerta() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT ((OLD.status = 'aberto' AND NEW.status IN ('analise', 'resolvido'))
            OR (OLD.status = 'analise' AND NEW.status = 'resolvido')) THEN
        RAISE EXCEPTION 'Não é possível mudar o alerta de % para %.', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alerta_transicao BEFORE UPDATE OF status ON alerta
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validar_transicao_alerta();

-- O descarte de efluentes é registro de auditoria: nem o dono do banco altera ou apaga.
CREATE FUNCTION bloquear_alteracao_efluente() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Descarte de efluentes não pode ser alterado nem excluído.';
END;
$$;

CREATE TRIGGER trg_efluente_imutavel BEFORE DELETE OR UPDATE ON efluentes_descarte
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_efluente();

-- TRUNCATE não dispara triggers de linha; sem este bloqueio, ele apagaria os registros imutáveis.
CREATE FUNCTION bloquear_truncate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'TRUNCATE não é permitido na tabela %.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_lote_sem_truncate BEFORE TRUNCATE ON lote
    FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER trg_auditoria_sem_truncate BEFORE TRUNCATE ON auditoria_usuario
    FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER trg_efluente_sem_truncate BEFORE TRUNCATE ON efluentes_descarte
    FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
