// Águas do Capibaribe — sensor de vazão simulado (US-09, fase 1 do IoT)
//
// Como funciona:
//   - O potenciômetro faz o papel do registro da água (0 a 30 L/min).
//   - O pino 25 gera os pulsos que um sensor de vazão real (YF-S201) geraria.
//     Um fio liga o pino 25 ao 27, onde os pulsos são contados por interrupção,
//     exatamente como seria com o sensor físico ligado no pino 27.
//   - Botão verde: 1º clique inicia o lote, 2º clique encerra e envia à API.
//   - LED azul aceso = lote em andamento.
//
// No dispositivo físico: remova o fio 25 -> 27, ligue o sinal do sensor no 27
// e calibre PULSOS_POR_LITRO.

#include <WiFi.h>
#include <HTTPClient.h>

// ===================== CONFIGURAÇÃO =====================
// HTTP simples: o HTTPS (TLS) fica lento demais no simulador. No físico/produção, use HTTPS.
// Endereço do túnel (muda a cada reinício do cloudflared), com /api no final.
const char* API_URL = "http://COLE-AQUI-O-ENDERECO-DO-TUNEL.trycloudflare.com/api";
// Senha da conta sensor.wokwi. Preencha só no Wokwi: NUNCA faça commit com a senha real.
const char* SENHA   = "COLE-AQUI-A-SENHA-DO-SENSOR";

const char* WIFI_SSID  = "Wokwi-GUEST";   // rede Wi-Fi do simulador
const char* WIFI_SENHA = "";

const char* USUARIO = "sensor.wokwi";

// Nome do processo cadastrado no site (Processos e metas), sem diferenciar maiúsculas.
// O sensor descobre o id sozinho, consultando a API; não é preciso olhar o banco.
const char* PROCESSO_NOME = "Estonagem";
const int PECAS = 50;  // peças do lote

// YF-S201: ~450 pulsos por litro (frequência = 7,5 x vazão em L/min). Calibrar no físico.
const float PULSOS_POR_LITRO = 450.0;
const float VAZAO_MAX_LPM    = 30.0;
// ========================================================

const int PINO_POT     = 34;  // potenciômetro (vazão)
const int PINO_GERADOR = 25;  // simula o sinal do sensor
const int PINO_SENSOR  = 27;  // entrada de pulsos
const int PINO_BOTAO   = 4;
const int PINO_LED     = 2;

volatile uint32_t pulsos = 0;
bool loteAtivo = false;
uint32_t freqAtual = 0;

void IRAM_ATTR contarPulso() {
  pulsos++;
}

float litrosMedidos() {
  noInterrupts();
  uint32_t p = pulsos;
  interrupts();
  return p / PULSOS_POR_LITRO;
}

// Ajusta a frequência dos pulsos simulados conforme a vazão escolhida no potenciômetro.
void ajustarGerador(float vazaoLpm) {
  uint32_t freq = (uint32_t)(vazaoLpm * PULSOS_POR_LITRO / 60.0);
  if (freq < 2) freq = 0;
  if (abs((int)freq - (int)freqAtual) < 2) return;
  freqAtual = freq;
  if (freq == 0) {
    ledcWrite(PINO_GERADOR, 0);
  } else {
    ledcChangeFrequency(PINO_GERADOR, freq, 10);
    ledcWrite(PINO_GERADOR, 512);  // 50% de ciclo
  }
}

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_SENHA, 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(" conectado.");
}

// Faz uma requisição POST com corpo JSON. Retorna o código HTTP e preenche a resposta.
int postJson(const String& url, const String& corpo, const String& token, String& resposta) {
  Serial.printf("POST %s ...\n", url.c_str());
  HTTPClient http;
  http.begin(url);
  http.setTimeout(20000);
  http.addHeader("Content-Type", "application/json");
  if (token.length() > 0) http.addHeader("Authorization", "Bearer " + token);
  int codigo = http.POST(corpo);
  resposta = codigo > 0 ? http.getString() : http.errorToString(codigo);
  http.end();
  Serial.printf("  -> HTTP %d\n", codigo);
  return codigo;
}

// Faz uma requisição GET autenticada. Retorna o código HTTP e preenche a resposta.
int getJson(const String& url, const String& token, String& resposta) {
  Serial.printf("GET %s ...\n", url.c_str());
  HTTPClient http;
  http.begin(url);
  http.setTimeout(20000);
  http.addHeader("Authorization", "Bearer " + token);
  int codigo = http.GET();
  resposta = codigo > 0 ? http.getString() : http.errorToString(codigo);
  http.end();
  Serial.printf("  -> HTTP %d\n", codigo);
  return codigo;
}

// Procura PROCESSO_NOME na lista de processos da API e devolve o id (ou -1).
// A lista vem como [{"id":4,"nome":"Estonagem","unidade":"peca","meta":12.00}, ...].
int buscarProcessoId(const String& token) {
  String resposta;
  if (getJson(String(API_URL) + "/processos", token, resposta) != 200) return -1;
  String lista = resposta;
  lista.toLowerCase();
  String alvo = String(PROCESSO_NOME);
  alvo.toLowerCase();
  int pos = lista.indexOf("\"nome\":\"" + alvo + "\"");
  if (pos < 0) {
    Serial.printf("Processo \"%s\" não encontrado. Processos cadastrados: %s\n", PROCESSO_NOME, resposta.c_str());
    return -1;
  }
  int ini = lista.lastIndexOf("\"id\":", pos);
  if (ini < 0) return -1;
  return lista.substring(ini + 5).toInt();
}

String fazerLogin() {
  String corpo = String("{\"usuario\":\"") + USUARIO + "\",\"senha\":\"" + SENHA + "\"}";
  String resposta;
  int codigo = postJson(String(API_URL) + "/auth/login", corpo, "", resposta);
  if (codigo != 200) {
    Serial.printf("Falha no login (HTTP %d): %s\n", codigo, resposta.c_str());
    return "";
  }
  const String chave = "\"token\":\"";
  int ini = resposta.indexOf(chave);
  if (ini < 0) return "";
  ini += chave.length();
  return resposta.substring(ini, resposta.indexOf('"', ini));
}

void enviarLote(float litros) {
  conectarWiFi();
  String token = fazerLogin();
  if (token.length() == 0) {
    Serial.println("Lote NAO enviado: sem login.");
    return;
  }
  int processoId = buscarProcessoId(token);
  if (processoId <= 0) {
    Serial.println("Lote NAO enviado: confira PROCESSO_NOME no sketch.ino.");
    return;
  }
  char corpo[96];
  snprintf(corpo, sizeof(corpo), "{\"processoId\":%d,\"pecas\":%d,\"litros\":%.2f}",
           processoId, PECAS, litros);
  String resposta;
  int codigo = postJson(String(API_URL) + "/lotes", corpo, token, resposta);
  if (codigo == 201) {
    Serial.printf("Lote registrado na API: %s\n", resposta.c_str());
  } else {
    Serial.printf("Falha ao registrar lote (HTTP %d): %s\n", codigo, resposta.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_BOTAO, INPUT_PULLUP);
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_SENSOR, INPUT);
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
  ledcAttach(PINO_GERADOR, 100, 10);
  ledcWrite(PINO_GERADOR, 0);

  Serial.println("Águas do Capibaribe - sensor de vazão (simulado)");
  conectarWiFi();
  Serial.println("Gire o potenciômetro para abrir a água e aperte o botão para iniciar o lote.");
}

void loop() {
  static uint32_t ultimoPot = 0, ultimoStatus = 0, ultimoBotao = 0;
  static bool botaoAntes = HIGH;
  uint32_t agora = millis();

  if (agora - ultimoPot >= 200) {
    ultimoPot = agora;
    ajustarGerador(analogRead(PINO_POT) / 4095.0 * VAZAO_MAX_LPM);
  }

  bool botao = digitalRead(PINO_BOTAO);
  if (botaoAntes == HIGH && botao == LOW && agora - ultimoBotao > 300) {
    ultimoBotao = agora;
    if (!loteAtivo) {
      noInterrupts();
      pulsos = 0;
      interrupts();
      loteAtivo = true;
      digitalWrite(PINO_LED, HIGH);
      Serial.println(">>> Lote iniciado.");
    } else {
      loteAtivo = false;
      digitalWrite(PINO_LED, LOW);
      float litros = litrosMedidos();
      Serial.printf(">>> Lote encerrado: %.2f L, %d pecas. Enviando...\n", litros, PECAS);
      if (litros < 0.01) {
        Serial.println("Nenhuma água medida: lote não enviado.");
      } else {
        enviarLote(litros);
      }
    }
  }
  botaoAntes = botao;

  if (loteAtivo && agora - ultimoStatus >= 1000) {
    ultimoStatus = agora;
    Serial.printf("Vazão: %.1f L/min | Acumulado: %.2f L\n",
                  freqAtual * 60.0 / PULSOS_POR_LITRO, litrosMedidos());
  }
}
