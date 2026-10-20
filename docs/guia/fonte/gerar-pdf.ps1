# Gera docs/guia/guia-aguas-do-capibaribe.pdf a partir de guia.html, usando o Chrome (ou o Edge).
# Uso, a partir desta pasta:  powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
# Precisa de internet para baixar as fontes (Bricolage Grotesque e Inter).

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $aqui 'guia.html'
$pdf = Join-Path (Split-Path -Parent $aqui) 'guia-aguas-do-capibaribe.pdf'

$navegadores = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$nav = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nav) { throw 'Chrome ou Edge não encontrado.' }

$url = 'file:///' + ($html -replace '\\', '/')
& $nav --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 --run-all-compositor-stages-before-draw "--print-to-pdf=$pdf" $url | Out-Null
Write-Host "PDF gerado: $pdf"
