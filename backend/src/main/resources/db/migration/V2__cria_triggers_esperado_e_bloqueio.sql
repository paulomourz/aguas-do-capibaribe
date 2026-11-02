-- V2: regras que moram no próprio banco (antes em database/banco.sql).

-- Calcula o esperado do lote a partir da meta do processo no momento do registro.
-- Por peça: meta × peças. Por lote: a própria meta.
CREATE FUNCTION preencher_esperado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_unidade VARCHAR(4);
    v_meta    NUMERIC(10,2);
BEGIN
    -- usuário desativado não registra lote
    IF NOT EXISTS (SELECT 1 FROM usuario WHERE id = NEW.usuario_id AND ativo = TRUE) THEN
        RAISE EXCEPTION 'Usuário inativo ou inexistente.';
    END IF;

    -- busca a meta do processo
    SELECT unidade, meta INTO v_unidade, v_meta
    FROM processo
    WHERE id = NEW.processo_id;

    IF v_unidade = 'peca' THEN
        NEW.esperado := v_meta * NEW.pecas;
    ELSE
        NEW.esperado := v_meta;
    END IF;

    RETURN NEW;   -- NEW = a linha que está sendo inserida
END;
$$;

-- Lote não se altera nem se apaga: o histórico de consumo é a prova do que aconteceu.
CREATE FUNCTION bloquear_alteracao_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Lote não pode ser alterado nem excluído.';
END;
$$;

CREATE TRIGGER trg_lote_esperado BEFORE INSERT ON lote
    FOR EACH ROW EXECUTE FUNCTION preencher_esperado();

CREATE TRIGGER trg_lote_imutavel BEFORE DELETE OR UPDATE ON lote
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_lote();
