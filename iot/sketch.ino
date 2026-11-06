// Águas do Capibaribe — sensor de vazão simulado (US-09, fase 1 do IoT)
//
// Como funciona:
//   - O potenciômetro faz o papel do registro da água (0 a 30 L/min).
//   - O pino 25 gera os pulsos que um sensor de vazão real (YF-S201) geraria.
//     Um fio liga o pino 25 ao 27, onde os pulsos são contados por interrupção,
//     exatamente como seria com o sensor físico ligado no pino 27.
//   - Botão verde: 1º clique inicia o lote, 2º clique encerra e envia à API.
//   - LED azul aceso = lote em andamento.
//   - Depois do envio, o status do lote volta da API e vira sinal (issue #83):
//       CRITICO        -> LED vermelho aceso e buzzer tocando por alguns segundos;
//       ATENCAO        -> LED vermelho piscando;
//       DENTRO_DA_META -> nada acende.
//     Se o envio falhar, nenhum sinal é dado.
//
// No dispositivo físico: remova o fio 25 -> 27, ligue o sinal do sensor no 27
// e calibre PULSOS_POR_LITRO.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ===================== CONFIGURAÇÃO =====================
// Endereço da API, com /api no final.
//   Projeto público: a API publicada, em https://, como abaixo.
//   Projeto local (Docker): o endereço do túnel, em http://. Ele muda toda vez que o túnel é ligado.
const char* API_URL = "https://aguas-api-a0vq.onrender.com/api";
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

// Certificado esperado da API: impressão digital SHA-256, válida até 20/12/2026. Verificar a cadeia inteira
// deixa a conexão lenta demais no simulador. Para ver a nova, depois que o Render renovar o certificado:
//   openssl s_client -connect aguas-api-a0vq.onrender.com:443 </dev/null | openssl x509 -noout -fingerprint -sha256
const char* API_HOST = "aguas-api-a0vq.onrender.com";
const char* IMPRESSAO_DIGITAL = "A8:8C:F8:E1:2B:2E:73:1A:48:5D:32:0C:92:B4:8E:A7:1E:0D:6B:F8:A8:38:68:B5:D1:10:DA:51:D4:A1:A4:5C";

// A API do plano grátis dorme sem uso e leva cerca de 2 minutos para acordar.
const uint16_t TEMPO_RESPOSTA_MS = 60000;  // o HTTPClient aceita no máximo 65 s
const int32_t  TEMPO_CONEXAO_MS  = 120000;
const uint32_t TEMPO_TLS_S       = 300;    // o TLS é lento no simulador
const int      TENTATIVAS_LOGIN  = 4;
// A negociação do TLS às vezes cai no simulador. Só repete se a conexão nem abriu: assim um lote já
// enviado nunca é enviado de novo.
const int      TENTATIVAS_CONEXAO = 3;

const int PINO_POT    = 34;  // potenciômetro (vazão)
const int PINO_GERADOR = 25;  // simula o sinal do sensor
const int PINO_SENSOR  = 27;  // entrada de pulsos
const int PINO_BOTAO   = 4;
const int PINO_LED     = 2;   // azul: lote em andamento
const int PINO_LED_ALERTA = 19;  // vermelho: status do lote enviado
const int PINO_BUZZER     = 26;
const uint8_t CANAL_GERADOR = 0;  // canal PWM (LEDC) do gerador: timer 0
const uint8_t CANAL_BUZZER  = 4;  // canal PWM do buzzer: timer 2

// Sinal do status do lote. O LED de CRITICO fica aceso até o próximo lote começar.
const uint32_t BUZZER_CRITICO_MS = 3000;
const uint32_t BUZZER_FREQ_HZ    = 2000;
const uint32_t PISCA_ATENCAO_MS  = 5000;
const uint32_t PISCA_PERIODO_MS  = 250;

volatile uint32_t pulsos = 0;
bool loteAtivo = false;
uint32_t freqAtual = 0;

// Uma só conexão segura para as requisições do lote: o TLS só é negociado uma vez.
WiFiClientSecure cliente;
WiFiClient clienteLocal;  // sem TLS, só para o projeto local
const bool usaHttps = strncmp(API_URL, "https://", 8) == 0;
HTTPClient http;
String token;          // guardado entre os lotes; renovado quando a API responde 401
int ultimoCodigo = 0;  // código HTTP da última requisição

enum Sinal { SINAL_NENHUM, SINAL_ATENCAO, SINAL_CRITICO };
Sinal sinal = SINAL_NENHUM;
uint32_t sinalInicio = 0;

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

// Abre a conexão segura e só a libera se o certificado for o esperado.
bool conectarSeguro() {
  if (!usaHttps || cliente.connected()) return true;
  if (!cliente.connect(API_HOST, 443, TEMPO_CONEXAO_MS)) {
    char erro[100] = "";
    cliente.lastError(erro, sizeof(erro));
    Serial.printf("  -> sem conexão segura: %s\n", erro);
    return false;
  }
  if (!cliente.verify(IMPRESSAO_DIGITAL, API_HOST)) {
    Serial.println("  -> certificado da API diferente do esperado: confira IMPRESSAO_DIGITAL.");
    cliente.stop();
    return false;
  }
  return true;
}

void abrirConexao(const String& url) {
  if (usaHttps) http.begin(cliente, url);
  else http.begin(clienteLocal, url);
  http.setReuse(true);
  http.setConnectTimeout(TEMPO_CONEXAO_MS);
  http.setTimeout(TEMPO_RESPOSTA_MS);
}

// Lê a resposta, guarda o código HTTP e encerra a requisição.
int concluir(int codigo, String& resposta) {
  resposta = codigo > 0 ? http.getString() : http.errorToString(codigo);
  http.end();
  ultimoCodigo = codigo;
  Serial.printf("  -> HTTP %d\n", codigo);
  return codigo;
}

// Faz uma requisição POST com corpo JSON. Retorna o código HTTP e preenche a resposta.
int postJson(const String& url, const String& corpo, const String& token, String& resposta) {
  int codigo = HTTPC_ERROR_CONNECTION_REFUSED;
  for (int i = 1; i <= TENTATIVAS_CONEXAO && codigo == HTTPC_ERROR_CONNECTION_REFUSED; i++) {
    Serial.printf("POST %s ...\n", url.c_str());
    if (!conectarSeguro()) continue;
    abrirConexao(url);
    http.addHeader("Content-Type", "application/json");
    if (token.length() > 0) http.addHeader("Authorization", "Bearer " + token);
    codigo = concluir(http.POST(corpo), resposta);
  }
  return codigo;
}

// Faz uma requisição GET autenticada. Retorna o código HTTP e preenche a resposta.
int getJson(const String& url, const String& token, String& resposta) {
  int codigo = HTTPC_ERROR_CONNECTION_REFUSED;
  for (int i = 1; i <= TENTATIVAS_CONEXAO && codigo == HTTPC_ERROR_CONNECTION_REFUSED; i++) {
    Serial.printf("GET %s ...\n", url.c_str());
    if (!conectarSeguro()) continue;
    abrirConexao(url);
    http.addHeader("Authorization", "Bearer " + token);
    codigo = concluir(http.GET(), resposta);
  }
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
  int codigo = -1;
  // Código negativo = sem resposta: a API pode estar acordando ou a conexão pode ter falhado.
  for (int i = 1; i <= TENTATIVAS_LOGIN && codigo < 0; i++) {
    codigo = postJson(String(API_URL) + "/auth/login", corpo, "", resposta);
    if (codigo < 0) Serial.printf("Sem resposta da API (tentativa %d de %d).\n", i, TENTATIVAS_LOGIN);
  }
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

// Lê "statusConformidade" da resposta do POST /lotes. Vazio se não vier.
String statusDaResposta(const String& resposta) {
  const String chave = "\"statusConformidade\":\"";
  int ini = resposta.indexOf(chave);
  if (ini < 0) return "";
  ini += chave.length();
  return resposta.substring(ini, resposta.indexOf('"', ini));
}

// Desliga o LED vermelho e o buzzer.
void apagarSinal() {
  sinal = SINAL_NENHUM;
  digitalWrite(PINO_LED_ALERTA, LOW);
  ledcWriteTone(PINO_BUZZER, 0);
}

// Começa o sinal do status do lote. O resto acontece em atualizarSinal(), sem travar o botão.
void sinalizar(const String& status) {
  apagarSinal();
  sinalInicio = millis();
  if (status == "CRITICO") {
    sinal = SINAL_CRITICO;
    digitalWrite(PINO_LED_ALERTA, HIGH);
    ledcWriteTone(PINO_BUZZER, BUZZER_FREQ_HZ);
    Serial.println("Status do lote: CRITICO (mais de 8% acima da meta) -> LED vermelho aceso e buzzer.");
  } else if (status == "ATENCAO") {
    sinal = SINAL_ATENCAO;
    Serial.println("Status do lote: ATENCAO (até 8% acima da meta) -> LED vermelho piscando.");
  } else if (status == "DENTRO_DA_META") {
    Serial.println("Status do lote: DENTRO_DA_META -> sem alerta.");
  } else {
    Serial.println("Status do lote não veio na resposta: sem alerta.");
  }
}

// Chamada a cada volta do loop: desliga o buzzer do CRITICO e faz o LED piscar no ATENCAO.
void atualizarSinal(uint32_t agora) {
  uint32_t passou = agora - sinalInicio;
  if (sinal == SINAL_CRITICO) {
    if (passou >= BUZZER_CRITICO_MS) ledcWriteTone(PINO_BUZZER, 0);  // o LED continua aceso
  } else if (sinal == SINAL_ATENCAO) {
    if (passou >= PISCA_ATENCAO_MS) {
      apagarSinal();
    } else {
      digitalWrite(PINO_LED_ALERTA, (passou / PISCA_PERIODO_MS) % 2 == 0 ? HIGH : LOW);
    }
  }
}

// Envia o lote e devolve o statusConformidade da API, ou "" se o lote não foi registrado.
String enviarLote(float litros) {
  conectarWiFi();
  // Segunda volta só se o login tiver vencido no meio (a sessão dura 8 horas).
  for (int volta = 0; volta < 2; volta++) {
    if (token.length() == 0) token = fazerLogin();
    if (token.length() == 0) {
      Serial.println("Lote NAO enviado: sem login.");
      return "";
    }
    int processoId = buscarProcessoId(token);
    if (processoId > 0) {
      char corpo[96];
      snprintf(corpo, sizeof(corpo), "{\"processoId\":%d,\"pecas\":%d,\"litros\":%.2f}",
               processoId, PECAS, litros);
      String resposta;
      int codigo = postJson(String(API_URL) + "/lotes", corpo, token, resposta);
      if (codigo == 201) {
        Serial.printf("Lote registrado na API: %s\n", resposta.c_str());
        return statusDaResposta(resposta);
      }
      if (codigo != 401) {
        Serial.printf("Falha ao registrar lote (HTTP %d): %s\n", codigo, resposta.c_str());
        return "";
      }
    } else if (ultimoCodigo != 401) {
      Serial.println("Lote NAO enviado: confira PROCESSO_NOME no sketch.ino.");
      return "";
    }
    Serial.println("Login vencido: entrando de novo.");
    token = "";
  }
  Serial.println("Lote NAO enviado: a API recusou o login.");
  return "";
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_BOTAO, INPUT_PULLUP);
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_LED_ALERTA, OUTPUT);
  // Canais em timers diferentes (o timer vale para um par de canais): o tom do buzzer não muda a
  // frequência do gerador de pulsos, nem a medição dos litros.
  ledcAttachChannel(PINO_BUZZER, BUZZER_FREQ_HZ, 8, CANAL_BUZZER);
  apagarSinal();
  pinMode(PINO_SENSOR, INPUT);
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
  ledcAttachChannel(PINO_GERADOR, 100, 10, CANAL_GERADOR);
  ledcWrite(PINO_GERADOR, 0);
  cliente.setInsecure();  // o certificado é conferido pela impressão digital em conectarSeguro()
  cliente.setHandshakeTimeout(TEMPO_TLS_S);
  WiFi.setAutoReconnect(true);

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
      apagarSinal();  // o alerta do lote anterior some quando o próximo começa
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
        // Gerador parado durante o envio: os pulsos deixam o TLS lento demais no simulador, e a API fecha a conexão.
        ledcWrite(PINO_GERADOR, 0);
        detachInterrupt(digitalPinToInterrupt(PINO_SENSOR));
        String status = enviarLote(litros);
        if (status.length() > 0) sinalizar(status);
        else Serial.println("Envio falhou: nenhum alerta acionado.");
        attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
        freqAtual = 0;
      }
    }
  }
  botaoAntes = botao;
  atualizarSinal(millis());  // não usa `agora`: o envio acima pode ter levado minutos

  if (loteAtivo && agora - ultimoStatus >= 1000) {
    ultimoStatus = agora;
    Serial.printf("Vazão: %.1f L/min | Acumulado: %.2f L\n",
                  freqAtual * 60.0 / PULSOS_POR_LITRO, litrosMedidos());
  }
}
