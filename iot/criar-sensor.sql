-- Prepara o banco para o sensor simulado (Wokwi). Rode UMA vez, no banco que a API usa.
-- Antes de rodar, troque 'TROQUE-ESTA-SENHA' por uma senha (mínimo 8 caracteres) e
-- use a mesma senha na constante SENHA do sketch.ino.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Conta do dispositivo: perfil operador, só consegue registrar lotes.
INSERT INTO public.usuario (nome, login, senha_hash, perfil)
VALUES ('Sensor de vazão (Wokwi)', 'sensor.wokwi', crypt('TROQUE-ESTA-SENHA', gen_salt('bf', 10)), 'operador');

-- O sensor precisa de pelo menos um processo cadastrado. Se ainda não houver,
-- crie pelo site (tela Processos) ou descomente a linha abaixo:
-- INSERT INTO public.processo (nome, unidade, meta) VALUES ('Estonagem', 'peca', 12);

-- Escolha um processo e coloque o NOME dele em PROCESSO_NOME no sketch.ino
-- (o sensor descobre o id sozinho pela API):
SELECT id, nome, unidade, meta FROM public.processo ORDER BY id;
