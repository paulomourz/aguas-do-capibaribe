# Gera os PDFs dos documentos de gestão (TAP, ERS, segurança e ciclo de vida) e dos técnicos das normas (arquitetura e
# testes, em docs/tecnico), a partir dos .md, usando o marked e o Chrome (ou o Edge). Cada PDF fica ao lado do seu .md.
# Uso, a partir desta pasta:  powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
# Precisa do Node.js (npx baixa o marked na primeira vez). O comentário <!-- sumario --> vira o sumário.

$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path

$navegadores = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$nav = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nav) { throw 'Chrome ou Edge não encontrado.' }

$documentos = @(
  @{ Nome = 'TAP'; Rodape = 'Águas do Capibaribe · Termo de Abertura do Projeto v3.2' },
  @{ Nome = 'ERS'; Rodape = 'Águas do Capibaribe · Especificação de Requisitos de Software v2.4 · ISO/IEC/IEEE 29148' },
  @{ Nome = 'seguranca'; Rodape = 'Águas do Capibaribe · Segurança da Informação v1.2 · ISO/IEC 27001' },
  @{ Nome = 'ciclo-de-vida'; Rodape = 'Águas do Capibaribe · Processos do Ciclo de Vida v1.0 · ISO/IEC 12207' },
  @{ Nome = 'arquitetura'; Pasta = '../tecnico'; Rodape = 'Águas do Capibaribe · Descrição da Arquitetura v1.2 · ISO/IEC/IEEE 42010' },
  @{ Nome = 'testes'; Pasta = '../tecnico'; Rodape = 'Águas do Capibaribe · Documentação de Testes v1.1 · ISO/IEC/IEEE 29119' }
)

$estilo = @'
@page { size: A4; margin: 18mm 18mm 20mm 18mm;
  @bottom-left { content: "RODAPE"; font: 8pt Calibri, Arial, sans-serif; color: #8a7a5c; }
  @bottom-right { content: counter(page); font: bold 9pt Calibri, Arial, sans-serif; color: #12344d; } }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 10.5pt/1.4 Calibri, Arial, sans-serif; color: #1f2933; }
img { max-width: 100%; break-inside: avoid; }
pre { font: 8.5pt Consolas, monospace; background: #faf6ee; padding: 6pt; white-space: pre; overflow: hidden; }
h1, h2, h3, h4 { color: #12344d; break-after: avoid; }
h1 { font-size: 18pt; margin: 0 0 8pt; }
h1:not(:first-of-type) { break-before: page; }
h2 { font-size: 14pt; margin: 14pt 0 4pt; }
h3 { font-size: 12pt; margin: 10pt 0 3pt; color: #1b4965; }
h4 { font-size: 11pt; margin: 10pt 0 2pt; }
p { margin: 0 0 6pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 10pt; font-size: 9.5pt; }
th { background: #f3ecdf; color: #12344d; text-align: left; border: 1px solid #d9c7a3; padding: 3pt 5pt; }
td { border: 1px solid #d9c7a3; padding: 3pt 5pt; vertical-align: top; }
tr { break-inside: avoid; }
blockquote { background: #f3ecdf; border-left: 4pt solid #b5543a; margin: 6pt 0 10pt; padding: 5pt 8pt; }
code { font: 9pt Consolas, monospace; background: #faf6ee; }
.sumario ul { list-style: none; padding: 0; } .sumario li.n2 { padding-left: 14pt; }
.sumario a { color: #1f2933; text-decoration: none; }
'@

foreach ($d in $documentos) {
  # Pasta do documento: esta, ou outra (docs/tecnico). O HTML temporário fica ao lado do .md, para as imagens
  # com caminho relativo (como os diagramas da arquitetura) aparecerem no PDF.
  $pasta = if ($d.Pasta) { [IO.Path]::GetFullPath((Join-Path $aqui $d.Pasta)) } else { $aqui }
  $md = Join-Path $pasta "$($d.Nome).md"
  $saida = Join-Path $pasta ".$($d.Nome).corpo.html"
  & npx --yes marked@12.0.2 -i $md -o $saida
  if ($LASTEXITCODE -ne 0) { throw "O marked falhou em $md." }
  $corpo = [IO.File]::ReadAllText($saida, [Text.Encoding]::UTF8)
  Remove-Item $saida

  # Cada título de nível 1 e 2 ganha um id, e o sumário aponta para eles (o primeiro <h1> é o título do documento).
  $itens = New-Object System.Collections.Generic.List[string]
  $script:n = 0
  $corpo = [regex]::Replace($corpo, '<(h[12])([^>]*)>(.*?)</\1>', {
    param($m)
    $script:n++
    $id = "s$script:n"
    if ($script:n -gt 1) {
      $classe = if ($m.Groups[1].Value -eq 'h1') { 'n1' } else { 'n2' }
      $itens.Add("<li class=""$classe""><a href=""#$id"">$($m.Groups[3].Value)</a></li>")
    }
    "<$($m.Groups[1].Value) id=""$id"">$($m.Groups[3].Value)</$($m.Groups[1].Value)>"
  })
  $sumario = '<div class="sumario"><h2>Sumário</h2><ul>' + ($itens -join '') + '</ul></div>'
  $corpo = $corpo.Replace('<!-- sumario -->', $sumario)

  $html = "<!doctype html><html lang=""pt-BR""><head><meta charset=""utf-8""><style>" +
    $estilo.Replace('RODAPE', $d.Rodape) + "</style></head><body>$corpo</body></html>"
  $temp = Join-Path $pasta ".$($d.Nome).gerado.html"
  [IO.File]::WriteAllText($temp, $html, (New-Object Text.UTF8Encoding $false))
  $pdf = Join-Path $pasta "$($d.Nome).pdf"
  $url = 'file:///' + ($temp -replace '\\', '/')
  & $nav --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 "--print-to-pdf=$pdf" $url | Out-Null
  Remove-Item $temp
  Write-Host "PDF gerado: $pdf"
}
