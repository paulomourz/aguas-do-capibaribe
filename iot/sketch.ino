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
//   - Sem Wi-Fi, o sensor continua medindo: cada lote encerrado vira uma leitura (pulsos, litros e hora) num
//     buffer circular de até 100 leituras na RAM. Quando o Wi-Fi volta, as leituras são enviadas em ordem, cada
//     uma com sua chave Idempotency-Key, para que um reenvio nunca duplique o lote na API.
//   - Para simular a perda de sinal: digite Q no monitor serial. O Wi-Fi cai por 60 segundos e volta sozinho.
//     A hora de cada leitura aparece no monitor serial; a API grava a hora em que o lote chega.
//   - Sinal de vida (issue #218): sem lote em andamento, o sensor envia a vazão atual a POST /telemetria a cada
//     15 s, logo depois de cada lote e, com a API respondendo, também ao iniciar um lote. Pela hora da última
//     leitura, a API diz se o sensor está no ar: /api/actuator/health/sensor fica UP com leitura há menos de 60 s.
//     Durante o lote nada é enviado (o envio pararia o contador de pulsos), por isso o lote deve durar menos de 1 min.
//
// No dispositivo físico: remova o fio 25 -> 27, ligue o sinal do sensor no 27
// e calibre o coeficiente K (PULSOS_POR_LITRO), como em iot/LEIA-ME.md, "Calibrar o coeficiente K".

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

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

// Perda de sinal simulada (comando Q no monitor serial) e buffer das leituras feitas sem Wi-Fi.
const uint32_t QUEDA_WIFI_MS = 60000;  // tempo que o Wi-Fi fica fora
const int      MAX_LEITURAS  = 100;    // leituras guardadas na RAM; cheio, a mais antiga é sobrescrita
const uint32_t ESPERA_REENVIO_MS = 15000;  // a API não respondeu: espera antes de tentar de novo
const uint32_t ESPERA_LIMITE_MS  = 60000;  // a API respondeu 429 (limite de lotes por minuto)
// Sinal de vida (POST /telemetria). A saúde do sensor na API cai para DOWN sem leitura por 60 s, então o
// intervalo precisa ficar bem abaixo disso. false desliga o envio (a saúde do sensor fica DOWN).
const bool     ENVIAR_TELEMETRIA       = true;
const uint32_t INTERVALO_TELEMETRIA_MS = 15000;
// Hora das leituras: relógio da internet (NTP), no fuso de Brasília.
const long FUSO_SEGUNDOS = -3 * 3600;
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
bool logHttp = true;   // false: não mostra cada requisição no monitor serial (sinal de vida, a cada 15 s)

// Uma leitura = um lote encerrado. A hora é guardada em millis() e convertida para data e hora quando o
// relógio estiver sincronizado: assim a hora sai certa mesmo se o lote foi medido antes de haver internet.
struct Leitura {
  uint32_t pulsos;
  float litros;
  uint32_t fimMs;   // millis() no encerramento do lote
  char chave[37];   // Idempotency-Key (UUID): a mesma em todas as tentativas desta leitura
};
Leitura leituras[MAX_LEITURAS];
enum Resultado { ENVIADA, RECUSADA, TENTAR_DEPOIS, PARAR };  // resultado do envio de uma leitura
int inicioBuffer = 0;  // posição da leitura mais antiga
int qtdLeituras = 0;

bool emQueda = false;        // perda de sinal simulada em andamento
uint32_t fimQuedaMs = 0;
bool wifiAntes = false;      // para avisar quando o Wi-Fi cai ou volta
uint32_t proximoEnvioMs = 0; // antes disso, não tenta enviar o buffer

int processoIdGuardado = -1;      // id de PROCESSO_NOME, guardado depois da 1ª consulta à API
uint32_t proximaTelemetriaMs = 0; // antes disso, não envia o sinal de vida
bool telemetriaOk = false;        // o último sinal de vida foi gravado: a API está acordada e respondendo

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

// Liga o Wi-Fi sem esperar: o loop continua medindo enquanto ele conecta.
void iniciarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_SENHA, 6);
  Serial.println("Conectando ao Wi-Fi...");
}

bool wifiDisponivel() {
  return !emQueda && WiFi.status() == WL_CONNECTED;
}

// Comando Q: derruba o Wi-Fi por QUEDA_WIFI_MS. O rádio é desligado para não reconectar sozinho.
void iniciarQueda() {
  if (emQueda) return;
  emQueda = true;
  fimQuedaMs = millis() + QUEDA_WIFI_MS;
  cliente.stop();
  WiFi.disconnect(true);
  Serial.printf(">>> Perda de sinal simulada: Wi-Fi fora por %lu s. As leituras ficam guardadas.\n",
                (unsigned long)(QUEDA_WIFI_MS / 1000));
}

// Avisa quando o Wi-Fi cai ou volta e encerra a queda simulada no tempo certo.
void acompanharWiFi() {
  if (emQueda && (int32_t)(millis() - fimQuedaMs) >= 0) {
    emQueda = false;
    Serial.println(">>> Fim da perda de sinal simulada.");
    iniciarWiFi();
  }
  bool agora = wifiDisponivel();
  if (agora && !wifiAntes) {
    Serial.println("Wi-Fi conectado.");
    configTime(FUSO_SEGUNDOS, 0, "pool.ntp.org", "time.google.com");
    proximoEnvioMs = millis();  // envia o que estiver guardado sem esperar
    proximaTelemetriaMs = millis();
  } else if (!agora && wifiAntes) {
    cliente.stop();
    telemetriaOk = false;
    Serial.println("Wi-Fi caiu. As leituras ficam guardadas até ele voltar.");
  }
  wifiAntes = agora;
}

// UUID versão 4, gerado com o sorteio de hardware do ESP32.
void gerarChave(char* destino) {
  uint8_t b[16];
  for (int i = 0; i < 16; i++) b[i] = esp_random() & 0xFF;
  b[6] = (b[6] & 0x0F) | 0x40;
  b[8] = (b[8] & 0x3F) | 0x80;
  snprintf(destino, 37, "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
}

// Data e hora em que a leitura foi medida. Sem relógio sincronizado, mostra há quanto tempo foi.
String horaDaLeitura(const Leitura& l) {
  uint32_t idadeS = (millis() - l.fimMs) / 1000;
  time_t agora = time(nullptr);
  char texto[64];
  if (agora < 1700000000) {  // relógio ainda não sincronizado pela internet
    snprintf(texto, sizeof(texto), "ha %lu s (hora ainda nao sincronizada)", (unsigned long)idadeS);
  } else {
    time_t quando = agora - idadeS;
    struct tm t;
    localtime_r(&quando, &t);
    strftime(texto, sizeof(texto), "%d/%m/%Y %H:%M:%S", &t);
  }
  return String(texto);
}

// Guarda a leitura no fim do buffer circular. Cheio, sobrescreve a mais antiga e avisa.
void guardarLeitura(uint32_t totalPulsos, float litros) {
  if (qtdLeituras == MAX_LEITURAS) {
    Serial.printf("!!! Buffer cheio (%d leituras): a mais antiga, de %.2f L, foi descartada.\n", MAX_LEITURAS,
                  leituras[inicioBuffer].litros);
    inicioBuffer = (inicioBuffer + 1) % MAX_LEITURAS;
    qtdLeituras--;
  }
  Leitura& l = leituras[(inicioBuffer + qtdLeituras) % MAX_LEITURAS];
  l.pulsos = totalPulsos;
  l.litros = litros;
  l.fimMs = millis();
  gerarChave(l.chave);
  qtdLeituras++;
  Serial.printf("Leitura guardada (%d de %d no buffer), medida em %s.\n", qtdLeituras, MAX_LEITURAS,
                horaDaLeitura(l).c_str());
}

void removerMaisAntiga() {
  inicioBuffer = (inicioBuffer + 1) % MAX_LEITURAS;
  qtdLeituras--;
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
  if (logHttp) Serial.printf("  -> HTTP %d\n", codigo);
  return codigo;
}

// Faz uma requisição POST com corpo JSON. Retorna o código HTTP e preenche a resposta.
// A chave (Idempotency-Key) faz a API devolver o lote já gravado, em vez de criar outro, num reenvio.
int postJson(const String& url, const String& corpo, const String& token, const char* chave, String& resposta) {
  int codigo = HTTPC_ERROR_CONNECTION_REFUSED;
  for (int i = 1; i <= TENTATIVAS_CONEXAO && codigo == HTTPC_ERROR_CONNECTION_REFUSED; i++) {
    if (logHttp) Serial.printf("POST %s ...\n", url.c_str());
    if (!conectarSeguro()) continue;
    abrirConexao(url);
    http.addHeader("Content-Type", "application/json");
    if (token.length() > 0) http.addHeader("Authorization", "Bearer " + token);
    if (chave != nullptr) http.addHeader("Idempotency-Key", chave);
    codigo = concluir(http.POST(corpo), resposta);
  }
  return codigo;
}

// Faz uma requisição GET autenticada. Retorna o código HTTP e preenche a resposta.
int getJson(const String& url, const String& token, String& resposta) {
  int codigo = HTTPC_ERROR_CONNECTION_REFUSED;
  for (int i = 1; i <= TENTATIVAS_CONEXAO && codigo == HTTPC_ERROR_CONNECTION_REFUSED; i++) {
    if (logHttp) Serial.printf("GET %s ...\n", url.c_str());
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

// Procura o processo na API. Código negativo = sem resposta: a API pode estar acordando.
// O id fica guardado depois da 1ª consulta (o sinal de vida sai a cada 15 s); a API recusar um envio por dados
// inválidos limpa o id guardado, e a próxima chamada consulta de novo.
int obterProcessoId() {
  if (processoIdGuardado > 0) return processoIdGuardado;
  int processoId = -1;
  for (int i = 1; i <= TENTATIVAS_API; i++) {
    processoId = buscarProcessoId(TOKEN_API);
    if (ultimoCodigo >= 0) break;
    Serial.printf("Sem resposta da API (tentativa %d de %d).\n", i, TENTATIVAS_API);
  }
  if (processoId > 0) processoIdGuardado = processoId;
  return processoId;
}

// Envia uma leitura como lote. 201 = gravado agora; 200 = a API já tinha esta chave (reenvio, sem duplicar).
Resultado enviarLeitura(const Leitura& l, int processoId, String& resposta) {
  char corpo[96];
  snprintf(corpo, sizeof(corpo), "{\"processoId\":%d,\"pecas\":%d,\"litros\":%.2f}", processoId, PECAS, l.litros);
  int codigo = postJson(String(API_URL) + "/lotes", corpo, TOKEN_API, l.chave, resposta);
  if (codigo == 201 || codigo == 200) {
    Serial.printf("Lote registrado na API: %s\n", resposta.c_str());
    return ENVIADA;
  }
  if (codigo == 401) {
    avisarTokenRecusado();
    return PARAR;
  }
  if (codigo < 0 || codigo == 429 || codigo >= 500) {
    Serial.printf("Sem envio agora (HTTP %d). A leitura continua guardada.\n", codigo);
    return TENTAR_DEPOIS;
  }
  // Outro 4xx: a API recusou os dados, e reenviar não muda a resposta.
  Serial.printf("A API recusou a leitura (HTTP %d): %s\n", codigo, resposta.c_str());
  processoIdGuardado = -1;  // o processo pode ter mudado: a próxima leitura consulta o id de novo
  return RECUSADA;
}

// Envia as leituras guardadas, da mais antiga para a mais nova, enquanto houver Wi-Fi.
void despejarLeituras() {
  if (!tokenConfigurado()) {
    Serial.println("Leituras NAO enviadas: cole o token de API do sensor em TOKEN_API (Usuarios > Rotacionar token).");
    proximoEnvioMs = millis() + ESPERA_LIMITE_MS;
    return;
  }
  Serial.printf(">>> Enviando %d leitura(s) guardada(s)...\n", qtdLeituras);
  // Gerador parado durante o envio: os pulsos deixam o TLS lento demais no simulador, e a API fecha a conexão.
  // Só acontece sem lote em andamento, então nenhum pulso de lote se perde.
  ledcWrite(PINO_GERADOR, 0);
  detachInterrupt(digitalPinToInterrupt(PINO_SENSOR));

  int processoId = obterProcessoId();
  // Com o id guardado, ultimoCodigo é o da requisição anterior: só vale quando o id não veio.
  if (processoId <= 0 && ultimoCodigo == 401) {
    avisarTokenRecusado();
    proximoEnvioMs = millis() + ESPERA_LIMITE_MS;
  } else if (processoId <= 0) {
    if (ultimoCodigo == 200) Serial.println("Leituras NAO enviadas: confira PROCESSO_NOME no sketch.ino.");
    else Serial.printf("Leituras NAO enviadas: a API respondeu HTTP %d ao listar os processos.\n", ultimoCodigo);
    proximoEnvioMs = millis() + ESPERA_REENVIO_MS;
  } else {
    while (qtdLeituras > 0) {
      if (!wifiDisponivel()) {
        Serial.println("Wi-Fi caiu durante o envio. O restante continua guardado.");
        break;
      }
      Leitura& l = leituras[inicioBuffer];
      Serial.printf("Leitura medida em %s: %.2f L (%lu pulsos).\n", horaDaLeitura(l).c_str(), l.litros,
                    (unsigned long)l.pulsos);
      String resposta;
      Resultado r = enviarLeitura(l, processoId, resposta);
      if (r == ENVIADA) {
        removerMaisAntiga();
        Serial.printf("Restam %d leitura(s) no buffer.\n", qtdLeituras);
        conferirStatus(resposta);
      } else if (r == RECUSADA) {
        Serial.println("Leitura descartada: a API nao aceita estes dados.");
        removerMaisAntiga();
      } else {
        proximoEnvioMs = millis() + (r == PARAR || ultimoCodigo == 429 ? ESPERA_LIMITE_MS : ESPERA_REENVIO_MS);
        break;
      }
    }
    if (qtdLeituras == 0) {
      Serial.println(">>> Buffer vazio: todas as leituras foram enviadas.");
      proximaTelemetriaMs = millis();  // sinal de vida logo depois do lote
    }
  }

  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
  freqAtual = 0;
}

// Vazão atual em L/min. No Wokwi vem do potenciômetro, que faz o papel do registro da água. No dispositivo
// físico, troque pela vazão medida: pulsos por segundo x 60 / PULSOS_POR_LITRO.
float vazaoAtualLpm() {
  return analogRead(PINO_POT) / 4095.0 * VAZAO_MAX_LPM;
}

// Sinal de vida (issue #218): grava a vazão atual em POST /telemetria. Pela hora da última leitura, a API diz se
// o sensor está no ar (/api/actuator/health/sensor). Como em despejarLeituras(), o gerador e o contador param
// durante o envio, então só é chamada sem lote em andamento (ou antes de zerar os pulsos de um lote novo).
// Com a API respondendo, não escreve no monitor serial: só avisa quando o sinal começa ou deixa de chegar.
void enviarTelemetria(float vazaoLpm) {
  bool estavaOk = telemetriaOk;
  logHttp = !estavaOk;
  if (!estavaOk) Serial.println(">>> Enviando sinal de vida (telemetria)...");
  ledcWrite(PINO_GERADOR, 0);
  detachInterrupt(digitalPinToInterrupt(PINO_SENSOR));

  int codigo;
  int processoId = obterProcessoId();
  if (processoId > 0) {
    char corpo[64];
    snprintf(corpo, sizeof(corpo), "{\"processoId\":%d,\"vazaoLitros\":%.2f}", processoId, vazaoLpm);
    String resposta;
    codigo = postJson(String(API_URL) + "/telemetria", corpo, TOKEN_API, nullptr, resposta);
    if (codigo >= 400 && codigo < 500 && codigo != 401 && codigo != 429) {
      Serial.printf("A API recusou o sinal de vida (HTTP %d): %s\n", codigo, resposta.c_str());
      processoIdGuardado = -1;  // o processo pode ter mudado: o próximo envio consulta o id de novo
    }
  } else {
    codigo = ultimoCodigo;  // o da consulta aos processos
    if (codigo == 200) Serial.println("Sinal de vida NAO enviado: confira PROCESSO_NOME no sketch.ino.");
  }
  telemetriaOk = codigo == 201;

  if (codigo == 401) {
    Serial.println("Sinal de vida NAO enviado: token recusado (HTTP 401). Gere outro em Usuarios > Rotacionar token.");
  } else if (telemetriaOk && !estavaOk) {
    Serial.printf("Sinal de vida OK: a API recebe a vazao a cada %lu s (agora %.1f L/min).\n",
                  (unsigned long)(INTERVALO_TELEMETRIA_MS / 1000), vazaoLpm);
  } else if (!telemetriaOk && estavaOk) {
    Serial.printf("Sinal de vida NAO chegou (HTTP %d). O sensor tenta de novo.\n", codigo);
  }

  proximaTelemetriaMs = millis() + (codigo == 401 || codigo == 429 ? ESPERA_LIMITE_MS : INTERVALO_TELEMETRIA_MS);
  logHttp = true;
  attachInterrupt(digitalPinToInterrupt(PINO_SENSOR), contarPulso, RISING);
  freqAtual = 0;  // o próximo ajuste religa o gerador na vazão do potenciômetro
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

  Serial.println("Águas do Capibaribe - sensor de vazão (simulado)");
  Serial.printf("Coeficiente K: %.1f pulsos por litro\n", PULSOS_POR_LITRO);
  if (MODO_CALIBRACAO) {
    // Nada vai para a API, então não precisa de Wi-Fi: dá para calibrar na bancada sem rede.
    Serial.printf("MODO DE CALIBRAÇÃO: passe %.1f L pelo sensor entre os dois cliques. O lote NÃO vai para a API.\n",
                  LITROS_CALIBRACAO);
  } else {
    iniciarWiFi();
    Serial.println("Para simular a perda de sinal, digite Q no monitor serial: o Wi-Fi cai por 60 s.");
    if (!tokenConfigurado()) {
      Serial.println("ATENCAO: cole o token de API do sensor em TOKEN_API (Usuarios > Rotacionar token).");
    }
  }
  Serial.println("Gire o potenciômetro para abrir a água e aperte o botão para iniciar o lote.");
}

void loop() {
  static uint32_t ultimoPot = 0, ultimoStatus = 0, ultimoBotao = 0;
  static bool botaoAntes = HIGH;
  uint32_t agora = millis();

  if (!MODO_CALIBRACAO) {
    while (Serial.available()) {
      char c = Serial.read();
      if (c == 'q' || c == 'Q') iniciarQueda();
    }
    acompanharWiFi();
  }

  if (agora - ultimoPot >= 200) {
    ultimoPot = agora;
    ajustarGerador(analogRead(PINO_POT) / 4095.0 * VAZAO_MAX_LPM);
  }

  bool botao = digitalRead(PINO_BOTAO);
  if (botaoAntes == HIGH && botao == LOW && agora - ultimoBotao > 300) {
    ultimoBotao = agora;
    if (!loteAtivo) {
      // O lote começa com o sinal de vida em dia: um lote de menos de 1 min mantém o sensor UP na API.
      // Só com a API já respondendo, para o início do lote não esperar a API acordar.
      if (ENVIAR_TELEMETRIA && !MODO_CALIBRACAO && telemetriaOk && qtdLeituras == 0 && wifiDisponivel()) {
        enviarTelemetria(vazaoAtualLpm());
      }
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
        Serial.printf(">>> Lote encerrado: %.2f L (%lu pulsos), %d pecas.\n", litros, (unsigned long)totalPulsos,
                      PECAS);
        guardarLeitura(totalPulsos, litros);
        if (!wifiDisponivel()) Serial.println("Sem Wi-Fi: a leitura sera enviada quando ele voltar.");
      }
    }
  }
  botaoAntes = botao;

  // Envia o buffer só sem lote em andamento: o envio para o contador de pulsos.
  // O apito do lote crítico também roda com o gerador parado, sem ser atrapalhado pelos pulsos.
  if (!loteAtivo && qtdLeituras > 0 && wifiDisponivel() && (int32_t)(millis() - proximoEnvioMs) >= 0) {
    despejarLeituras();
  }

  // Sinal de vida a cada INTERVALO_TELEMETRIA_MS, só sem lote em andamento e com o buffer vazio
  // (as leituras guardadas vão primeiro).
  if (ENVIAR_TELEMETRIA && !MODO_CALIBRACAO && !loteAtivo && qtdLeituras == 0 && wifiDisponivel() &&
      tokenConfigurado() && (int32_t)(millis() - proximaTelemetriaMs) >= 0) {
    enviarTelemetria(vazaoAtualLpm());
  }

  if (loteAtivo && agora - ultimoStatus >= 1000) {
    ultimoStatus = agora;
    Serial.printf("Vazão: %.1f L/min | Acumulado: %.2f L | Pulsos: %lu\n",
                  freqAtual * 60.0 / PULSOS_POR_LITRO, litrosMedidos(), (unsigned long)pulsosContados());
  }
}
