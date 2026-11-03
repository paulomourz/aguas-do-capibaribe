package br.com.aguas.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades "app.limite.*": quantas requisições por minuto são aceitas.
 * cabecalhoIp é o cabeçalho com o IP real do cliente, preenchido pelo proxy na frente da API
 * (ex.: X-Real-IP no Docker). Vazio = usa o IP da conexão. Só configure um cabeçalho que o proxy sempre
 * sobrescreve: se o cliente puder escolher o valor, ele escapa do limite.
 */
@ConfigurationProperties("app.limite")
public record LimiteProperties(int loginPorMinuto, int lotesPorMinuto, String cabecalhoIp) {}
