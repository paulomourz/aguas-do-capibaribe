// Caderno do slide 9: anotações à mão e gráfico da economia estimada, em PNG 2x com fundo transparente.
// Números: até R$ 40 mil por mês de economia (slides 4 e 10) e R$ 14,50 por m³ (o preço da tela de custo).
// Rode na raiz do projeto: node docs/guia/estande/molduras/gerar-caderno.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const { chromium } = createRequire(import.meta.url)('@playwright/test');
const OUT = dirname(fileURLToPath(import.meta.url));

const ECONOMIA_MES = 40000;
const PRECO_M3 = 14.5;
const meses = [1, 2, 3, 4, 5, 6].map((m) => ({
  rotulo: `mês ${m}`,
  reais: ECONOMIA_MES * m,
  m3: Math.round(ECONOMIA_MES / PRECO_M3 / 10) * 10 * m,
}));
const fmt = (n) => n.toLocaleString('pt-BR');

// Gráfico de barras: altura = economia acumulada em reais; embaixo, a água poupada no mesmo período.
const W = 600, H = 300, base = 250, topo = 40, larg = 62, passo = 92, x0 = 40;
const max = meses.at(-1).reais;
const barras = meses.map((d, i) => {
  const h = ((base - topo) * d.reais) / max, x = x0 + i * passo, y = base - h;
  return `<path d="M${x},${base} V${y + 4} a4,4 0 0 1 4,-4 h${larg - 8} a4,4 0 0 1 4,4 V${base} Z" fill="${i === meses.length - 1 ? '#C6532D' : '#2F6F8F'}"/>
    <text x="${x + larg / 2}" y="${y - 10}" class="v">R$ ${d.reais / 1000} mil</text>
    <text x="${x + larg / 2}" y="${base + 26}" class="m">${d.rotulo}</text>
    <text x="${x + larg / 2}" y="${base + 50}" class="a">${fmt(d.m3)} m³</text>`;
}).join('');
const grafico = `<svg viewBox="0 0 ${W} ${H + 40}" width="${W}" height="${H + 40}">
  <line x1="${x0 - 12}" y1="${base}" x2="${x0 + 5 * passo + larg + 12}" y2="${base}" stroke="#0A3654" stroke-width="2"/>
  ${barras}</svg>`;

const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; }
body { background: transparent; }
.palco { padding: 18px; display: inline-block; }
.folha { width: 760px; padding: 34px 40px 26px 84px; border-radius: 14px; position: relative;
  background: #FFFDF7 repeating-linear-gradient(#FFFDF7 0 43px, #BFD9E2 43px 45px);
  background-position: 0 22px; box-shadow: 0 6px 14px rgba(10,30,50,.16); font-family: 'Caveat', cursive; color: #0A3654; }
.folha::before { content: ''; position: absolute; left: 62px; top: 0; bottom: 0; width: 2px; background: #E9A28A; }
.espiral { position: absolute; left: 18px; top: 26px; bottom: 26px; width: 22px;
  background: radial-gradient(circle at 11px 11px, #F2E9E0 6px, #9FB3BF 7px, transparent 8px) 0 0 / 22px 44px repeat-y; }
h2 { font-size: 46px; font-weight: 700; line-height: 45px; color: #C6532D; }
p { font-size: 34px; font-weight: 600; line-height: 45px; }
p b { color: #C6532D; }
.seta { color: #C6532D; }
.titulo-graf { font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 700; margin-top: 14px; line-height: 26px; }
.sub { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: #47657A; line-height: 22px; }
svg { display: block; margin-top: 4px; font-family: 'Inter', sans-serif; }
.v { font-size: 17px; font-weight: 700; fill: #0A3654; text-anchor: middle; }
.m { font-size: 16px; font-weight: 600; fill: #47657A; text-anchor: middle; }
.a { font-size: 17px; font-weight: 700; fill: #2F6F8F; text-anchor: middle; }
</style>
<div class="palco"><div class="folha"><div class="espiral"></div>
  <h2>Menos desperdício = mais lucro</h2>
  <p>Água comprada hoje: ~R$ 56 mil/mês</p>
  <p>Meta por lote + alerta <span class="seta">→</span> acaba o excesso</p>
  <p>Até <b>R$ 40 mil/mês</b> a menos na conta</p>
  <p>R$ 14,50 o m³ <span class="seta">→</span> <b>~2.760 m³</b> poupados/mês</p>
  <div class="titulo-graf">Economia acumulada no piloto (estimativa)</div>
  <div class="sub">barras: reais economizados · embaixo: água poupada</div>
  ${grafico}
</div></div>`;

const n = await chromium.launch();
const p = await (await n.newContext({ deviceScaleFactor: 2, viewport: { width: 1000, height: 1200 } })).newPage();
await p.setContent(html);
await p.waitForLoadState('networkidle');
await p.evaluate(() => document.fonts.ready);
await p.locator('.palco').screenshot({ path: `${OUT}/caderno-economia.png`, omitBackground: true });
const b = await p.locator('.palco').boundingBox();
console.log('caderno-economia', Math.round(b.width), Math.round(b.height));
await n.close();
