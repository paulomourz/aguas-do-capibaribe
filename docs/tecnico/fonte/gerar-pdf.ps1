# Gera docs/tecnico/hardware-bancada.pdf a partir de hardware-bancada.html, usando o Chrome (ou o Edge).
# Uso, a partir desta pasta:  powershell -ExecutionPolicy Bypass -File .\gerar-pdf.ps1
# Precisa de internet para baixar as fontes (Bricolage Grotesque e Inter).

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $aqui 'hardware-bancada.html'
$pdf = Join-Path (Split-Path -Parent $aqui) 'hardware-bancada.pdf'

$navegadores = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$nav = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nav) { throw 'Chrome ou Edge não encontrado.' }

$url = 'file:///' + ($html -replace '\\', '/')
& $nav --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 --run-all-compositor-stages-before-draw "--print-to-pdf=$pdf" $url | Out-Null
Write-Host "PDF gerado: $pdf"
