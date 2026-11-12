-- V11: reenvio dos avisos pendentes do Telegram (#97).
-- Uma rotina da API tenta de novo, de tempos em tempos, os avisos que ficaram em aviso_pendente. Quando um chega,
-- enviado_em recebe a hora do envio; enquanto estiver vazio, o aviso continua pendente. A linha nunca é apagada
-- (o aguas_api não tem DELETE): a tabela vira o histórico do que atrasou e de quando chegou.

ALTER TABLE aviso_pendente ADD COLUMN enviado_em timestamp with time zone;

-- A rotina só procura os que ainda não saíram.
CREATE INDEX idx_aviso_pendente_nao_enviado ON aviso_pendente (criado_em) WHERE enviado_em IS NULL;

-- Usuário da API (se já existir): além de ler e inserir, atualiza só as colunas do reenvio.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aguas_api') THEN
        GRANT UPDATE (enviado_em, tentativas, ultimo_erro) ON aviso_pendente TO aguas_api;
    END IF;
END;
$$;
