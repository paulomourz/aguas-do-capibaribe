// Águas do Capibaribe — sensor de vazão simulado (US-09, fase 1 do IoT)
//
// Como funciona:
//   - O potenciômetro faz o papel do registro da água (0 a 30 L/min).
//   - O pino 25 gera os pulsos que um sensor de vazão real (YF-S201) geraria.
//     Um fio liga o pino 25 ao 27, onde os pulsos são contados por interrupção,
//     exatamente como seria com o sensor físico ligado no pino 27.
//   - Botão verde: 1º clique inicia o lote, 2º clique encerra e envia à API.
//   - O sensor se identifica pelo token de API da conta de sensor (Authorization: Bearer <token>), sem login
//     nem senha. O token é gerado no site, em Usuários > Rotacionar token; gerar outro invalida o anterior.
//   - LED azul aceso = lote em andamento.
//   - Lote crítico (desvio acima de 8%, segundo a API): o buzzer apita 3 vezes e o LED vermelho pisca e fica
//     aceso até o próximo lote começar. Quem classifica é a API (campo "statusConformidade" da resposta), então
//     o sensor segue sempre a mesma regra do site.
//
// No dispositivo físico: remova o fio 25 -> 27, ligue o sinal do sensor no 27
// e calibre o coeficiente K (PULSOS_POR_LITRO), como em iot/LEIA-ME.md, "Calibrar o coeficiente K".

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ===================== CONFIGURAÇÃO =====================
// Endereço da API, com /api no final.
//   Projeto público: a API publicada, em https://, como abaixo.
//   Projeto local (Docker): o endereço do túnel, em http://. Ele muda toda vez que o túnel é ligado.
const char* API_URL = "https://aguas-api-a0vq.onrender.com/api";
// Token de API da conta sensor.wokwi (64 letras e números), gerado no site em Usuários > Rotacionar token.
// Preencha só no Wokwi: NUNCA faça commit com o token real. Ele aparece uma vez só, na hora da rotação.
const char* TOKEN_API = "COLE-AQUI-O-TOKEN-DO-SENSOR";

const char* WIFI_SSID  = "Wokwi-GUEST";   // rede Wi-Fi do simulador
const char* WIFI_SENHA = "";

// Nome do processo cadastrado no site (Processos e metas), sem diferenciar maiúsculas.
// O sensor descobre o id sozinho, consultando a API; não é preciso olhar o banco.
const char* PROCESSO_NOME = "Estonagem";
const int PECAS = 50;  // peças do lote

// Coeficiente K do sensor de vazão: quantos pulsos ele gera por litro. Litros do lote = pulsos / K.
// Cada modelo tem o seu, e cada unidade varia um pouco. YF-S201: ~450 (frequência = 7,5 x vazão em L/min).
// Com outro modelo, comece pelo valor do fabricante e calibre: iot/LEIA-ME.md, "Calibrar o coeficiente K".
const float PULSOS_POR_LITRO = 450.0;

// Modo de calibração: true = ao encerrar, mostra os pulsos e o K calculado e NÃO envia o lote à API.
// Volte para false depois de calibrar.
const bool  MODO_CALIBRACAO   = false;
const float LITROS_CALIBRACAO = 10.0;  // volume conhecido do recipiente usado na calibração, em litros

// Só no Wokwi: o K do sensor "físico" que o gerador de pulsos imita. Deixe igual ao PULSOS_POR_LITRO.
// Para testar a calibração, use valores diferentes: os litros saem errados, como num sensor não calibrado.
const float PULSOS_POR_LITRO_SIMULADO = 450.0;
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
const int      TENTATIVAS_API    = 4;    // a 1ª requisição do lote espera a API acordar
// A negociação do TLS às vezes cai no simulador. Só repete se a conexão nem abriu: assim um lote já
// enviado nunca é enviado de novo.
const int      TENTATIVAS_CONEXAO = 3;

const int PINO_POT    = 34;  // potenciômetro (vazão)
const int PINO_GERADOR = 25;  // simula o sinal do sensor
const int PINO_SENSOR  = 27;  // entrada de pulsos
const int PINO_BOTAO   = 4;
const int PINO_LED     = 2;
const int PINO_BUZZER  = 26;  // apito do lote crítico
const int PINO_LED_CRITICO = 33;  // LED vermelho do lote crítico

// Aviso de lote crítico: 3 apitos de 2 kHz. O som é gerado no próprio código, sem LEDC, porque o gerador do
// pino 25 já usa o LEDC e dois canais no mesmo timer disputam a frequência.
const uint32_t FREQ_APITO_HZ = 2000;
const uint32_t DURACAO_APITO_MS = 300;
const int      QTD_APITOS = 3;

volatile uint32_t pulsos = 0;
bool loteAtivo = false;
uint32_t freqAtual = 0;

// Uma só conexão segura para as requisições do lote: o TLS só é negociado uma vez.
WiFiClientSecure cliente;
WiFiClient clienteLocal;  // sem TLS, só para o projeto local
const bool usaHttps = strncmp(API_URL, "https://", 8) == 0;
HTTPClient http;
int ultimoCodigo = 0;  // código HTTP da última requisição

void IRAM_ATTR contarPulso() {
  pulsos++;
}

uint32_t pulsosContados() {
  noInterrupts();
  uint32_t p = pulsos;
  interrupts();
  return p;
}

float litrosMedidos() {
  return pulsosContados() / PULSOS_POR_LITRO;
}

// Ajusta a frequência dos pulsos simulados conforme a vazão escolhida no potenciômetro.
// Usa o K do sensor simulado, e não o configurado: assim o Wokwi mostra o efeito de um K errado.
void ajustarGerador(float vazaoLpm) {
  uint32_t freq = (uint32_t)(vazaoLpm * PULSOS_POR_LITRO_SIMULADO / 60.0);
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

// O token só tem o formato certo depois de colado (64 letras e números).
bool tokenConfigurado() {
  if (strlen(TOKEN_API) != 64) return false;
  for (const char* c = TOKEN_API; *c; c++) if (!isalnum((unsigned char)*c)) return false;
  return true;
}

void avisarTokenRecusado() {
  Serial.println("Lote NAO enviado: token recusado (HTTP 401). Ele foi trocado ou a conta foi desativada:");
  Serial.println("  gere outro no site, em Usuarios > Rotacionar token, e cole em TOKEN_API.");
}

// Envia o lote. Devolve a resposta da API (o lote gravado, em JSON) ou "" se o lote não foi registrado.
String enviarLote(float litros) {
  conectarWiFi();
  if (!tokenConfigurado()) {
    Serial.println("Lote NAO enviado: cole o token de API do sensor em TOKEN_API (Usuarios > Rotacionar token).");
    return "";
  }
  // Código negativo = sem resposta: a API pode estar acordando ou a conexão pode ter falhado.
  int processoId = -1;
  for (int i = 1; i <= TENTATIVAS_API; i++) {
    processoId = buscarProcessoId(TOKEN_API);
    if (ultimoCodigo >= 0) break;
    Serial.printf("Sem resposta da API (tentativa %d de %d).\n", i, TENTATIVAS_API);
  }
  if (ultimoCodigo == 401) {
    avisarTokenRecusado();
    return "";
  }
  if (processoId <= 0) {
    if (ultimoCodigo == 200) Serial.println("Lote NAO enviado: confira PROCESSO_NOME no sketch.ino.");
    else Serial.printf("Lote NAO enviado: a API respondeu HTTP %d ao listar os processos.\n", ultimoCodigo);
    return "";
  }
  char corpo[96];
  snprintf(corpo, sizeof(corpo), "{\"processoId\":%d,\"pecas\":%d,\"litros\":%.2f}", processoId, PECAS, litros);
  String resposta;
  int codigo = postJson(String(API_URL) + "/lotes", corpo, TOKEN_API, resposta);
  if (codigo == 201) {
    Serial.printf("Lote registrado na API: %s\n", resposta.c_str());
    return resposta;
  }
  if (codigo == 401) avisarTokenRecusado();
  else Serial.printf("Falha ao registrar lote (HTTP %d): %s\n", codigo, resposta.c_str());
  return "";
}

// Lê um campo de texto da resposta, como "statusConformidade":"CRITICO". Devolve "" se não achar.
String campoTexto(const String& json, const char* nome) {
  String chave = String("\"") + nome + "\":\"";
  int ini = json.indexOf(chave);
  if (ini < 0) return "";
  ini += chave.length();
  int fim = json.indexOf('"', ini);
  return fim < 0 ? "" : json.substring(ini, fim);
}

// Lê um campo numérico da resposta, como "desvio":12.35. Devolve 0 se não achar.
float campoNumero(const String& json, const char* nome) {
  String chave = String("\"") + nome + "\":";
  int ini = json.indexOf(chave);
  if (ini < 0) return 0;
  return json.substring(ini + chave.length()).toFloat();
}

// Um apito: onda quadrada no pino do buzzer, durante "ms" milissegundos.
void apitar(uint32_t freqHz, uint32_t ms) {
  uint32_t meioPeriodoUs = 500000UL / freqHz;
  uint32_t inicio = millis();
  while (millis() - inicio < ms) {
    digitalWrite(PINO_BUZZER, HIGH);
    delayMicroseconds(meioPeriodoUs);
    digitalWrite(PINO_BUZZER, LOW);
    delayMicroseconds(meioPeriodoUs);
  }
}

// Som e luz do lote crítico. O LED vermelho pisca junto com os apitos e fica aceso no fim.
void avisarLoteCritico() {
  for (int i = 0; i < QTD_APITOS; i++) {
    digitalWrite(PINO_LED_CRITICO, HIGH);
    apitar(FREQ_APITO_HZ, DURACAO_APITO_MS);
    digitalWrite(PINO_LED_CRITICO, LOW);
    delay(200);
  }
  digitalWrite(PINO_LED_CRITICO, HIGH);
}

// Mostra o status que a API deu ao lote e avisa se ele for crítico.
void conferirStatus(const String& resposta) {
  String status = campoTexto(resposta, "statusConformidade");
  float desvio = campoNumero(resposta, "desvio");
  if (status.length() == 0) {
    Serial.println("A API não informou o status do lote.");
    return;
  }
  Serial.printf("Status do lote: %s (desvio de %.2f%%)\n", status.c_str(), desvio);
  if (status == "CRITICO") {
    Serial.println("!!! LOTE CRITICO: desvio acima de 8%. Confira o processo. !!!");
    avisarLoteCritico();
  }
}

// Fim de uma medição no modo de calibração: K = pulsos / litros do recipiente. Nada é enviado à API.
void mostrarCalibracao(uint32_t totalPulsos) {
  float kCalculado = totalPulsos / LITROS_CALIBRACAO;
  Serial.printf(">>> Calibração encerrada: %lu pulsos para %.1f L.\n", (unsigned long)totalPulsos, LITROS_CALIBRACAO);
  Serial.printf("    K calculado = %lu / %.1f = %.1f pulsos por litro.\n", (unsigned long)totalPulsos,
                LITROS_CALIBRACAO, kCalculado);
  Serial.printf("    Com o K atual (%.1f), o sensor mediria %.2f L.\n", PULSOS_POR_LITRO,
                totalPulsos / PULSOS_POR_LITRO);
  Serial.println("    Repita pelo menos 3 vezes e coloque a média em PULSOS_POR_LITRO. Lote não enviado.");
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_BOTAO, INPUT_PULLUP);
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);
  pinMode(PINO_LED_CRITICO, OUTPUT);
  digitalWrite(PINO_BUZZER, LOW);
  digitalWrite(PINO_LED_CRITICO, LOW);
  pinMode(PINO_SENSOR, INPUT);
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
  ledcAttach(PINO_GERADOR, 100, 10);
  ledcWrite(PINO_GERADOR, 0);
  cliente.setInsecure();  // o certificado é conferido pela impressão digital em conectarSeguro()
  cliente.setHandshakeTimeout(TEMPO_TLS_S);
  WiFi.setAutoReconnect(true);

  Serial.println("Águas do Capibaribe - sensor de vazão (simulado)");
  Serial.printf("Coeficiente K: %.1f pulsos por litro\n", PULSOS_POR_LITRO);
  if (MODO_CALIBRACAO) {
    // Nada vai para a API, então não precisa de Wi-Fi: dá para calibrar na bancada sem rede.
    Serial.printf("MODO DE CALIBRAÇÃO: passe %.1f L pelo sensor entre os dois cliques. O lote NÃO vai para a API.\n",
                  LITROS_CALIBRACAO);
  } else {
    conectarWiFi();
  }
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
      digitalWrite(PINO_LED_CRITICO, LOW);  // o aviso do lote anterior se apaga
      Serial.println(">>> Lote iniciado.");
    } else {
      loteAtivo = false;
      digitalWrite(PINO_LED, LOW);
      uint32_t totalPulsos = pulsosContados();
      float litros = totalPulsos / PULSOS_POR_LITRO;
      if (MODO_CALIBRACAO) {
        mostrarCalibracao(totalPulsos);
      } else if (litros < 0.01) {
        Serial.println(">>> Lote encerrado: nenhuma água medida, lote não enviado.");
      } else {
        Serial.printf(">>> Lote encerrado: %.2f L (%lu pulsos), %d pecas. Enviando...\n", litros,
                      (unsigned long)totalPulsos, PECAS);
        // Gerador parado durante o envio: os pulsos deixam o TLS lento demais no simulador, e a API fecha a conexão.
        ledcWrite(PINO_GERADOR, 0);
        detachInterrupt(digitalPinToInterrupt(PINO_SENSOR));
        String resposta = enviarLote(litros);
        // Ainda com o gerador parado: o apito é gerado no código e não pode ser atrapalhado pelos pulsos.
        if (resposta.length() > 0) conferirStatus(resposta);
        attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
        freqAtual = 0;
      }
    }
  }
  botaoAntes = botao;

  if (loteAtivo && agora - ultimoStatus >= 1000) {
    ultimoStatus = agora;
    Serial.printf("Vazão: %.1f L/min | Acumulado: %.2f L | Pulsos: %lu\n",
                  freqAtual * 60.0 / PULSOS_POR_LITRO, litrosMedidos(), (unsigned long)pulsosContados());
  }
}
