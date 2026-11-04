-- V5: chave de envio do lote (registro offline no site).
-- O site gera um UUID para cada lote antes de enviar e o repete a cada nova tentativa (cabeçalho
-- Idempotency-Key). Se a resposta se perder na Wi-Fi da lavanderia e o site reenviar, a API encontra
-- a chave e devolve o lote já gravado em vez de criar outro.
-- Opcional: o sensor (ESP32) e lotes antigos ficam com NULL, e o índice único aceita vários NULL.

ALTER TABLE lote ADD COLUMN chave_envio uuid;

CREATE UNIQUE INDEX ux_lote_chave_envio ON lote USING btree (chave_envio);
