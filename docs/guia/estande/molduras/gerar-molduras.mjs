// Gera as molduras do deck da feira (navegador e celular), em PNG 2x com fundo transparente.
// Uso, na raiz do projeto: node docs/guia/estande/molduras/gerar-molduras.mjs
// Precisa do Playwright instalado (pnpm install). As capturas de origem ficam em fonte/.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('@playwright/test');
const AQUI = dirname(fileURLToPath(import.meta.url));
const T = join(AQUI, 'fonte');
const DEMO = join(AQUI, '..', 'demonstracao');
const OUT = AQUI;
import { readFileSync } from 'node:fs';
const u = (f) => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(f).toString('base64')}`;
const SOMBRA = 40;

const css = `
* { box-sizing: border-box; margin: 0; }
body { background: transparent; font-family: 'Segoe UI', Arial, sans-serif; }
.palco { padding: ${SOMBRA}px; display: inline-block; }
.nav { border-radius: 26px; background: #0A3654; padding: 0 8px 8px; box-shadow: 0 22px 44px rgba(10,30,50,.38), 0 4px 10px rgba(10,30,50,.25); }
.barra { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 14px; }
.ponto { width: 18px; height: 18px; border-radius: 50%; }
.url { flex: 1; margin-left: 14px; height: 40px; border-radius: 20px; background: #ffffff1f; color: #fff; display: flex; align-items: center; padding: 0 20px; font-size: 21px; font-weight: 600; letter-spacing: .2px; }
.url b { color: #9AC5CE; font-weight: 600; margin-right: 6px; }
.tela { border-radius: 0 0 18px 18px; overflow: hidden; background: #F2E9E0; }
.tela img { display: block; width: 100%; }
.vazado { background: transparent !important; padding: 0 !important; box-shadow: none !important; filter: drop-shadow(0 16px 22px rgba(10,30,50,.4)); }
.vazado .barra { background: #0A3654; border-radius: 26px 26px 0 0; }
.vazado .tela { background: transparent; border: 8px solid #0A3654; border-top: 0; border-radius: 0 0 26px 26px; }
.cel { width: 400px; border-radius: 62px; background: #0E1116; padding: 16px; box-shadow: 0 24px 48px rgba(10,30,50,.45), inset 0 0 0 3px #3A414B; position: relative; }
.cel .tela2 { border-radius: 46px; overflow: hidden; position: relative; }
.cel .tela2 img { display: block; width: 100%; }
.ilha { position: absolute; top: 28px; left: 50%; transform: translateX(-50%); width: 110px; height: 30px; border-radius: 15px; background: #000; z-index: 2; }
`;

const navegador = (img, url, largura, alturaTela) => `<div class="palco"><div class="nav" style="width:${largura + 16}px">
  <div class="barra"><span class="ponto" style="background:#FF5F57"></span><span class="ponto" style="background:#FEBC2E"></span><span class="ponto" style="background:#28C840"></span>
  <div class="url"><b>🔒</b>${url}</div></div>
  <div class="tela" style="height:${alturaTela}px">${img ? `<img src="${u(img)}">` : ''}</div></div></div>`;

const n = await chromium.launch();
const p = await (await n.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1200 } })).newPage();
async function gera(nome, html, transparenteNaTela = false) {
  await p.setContent(`<style>${css}</style>${html}`);
  await p.waitForLoadState('networkidle');
  if (transparenteNaTela) await p.evaluate(() => { const nv = document.querySelector('.nav'); nv.classList.add('vazado'); const t = document.querySelector('.tela'); t.style.height = (parseFloat(t.style.height) + 8) + 'px'; });
  await p.locator('.palco').screenshot({ path: `${OUT}/${nome}.png`, omitBackground: true });
  const b = await p.locator('.palco').boundingBox();
  console.log(nome, Math.round(b.width), Math.round(b.height));
}

// Dashboard e alerta: 2950x2050 -> tela 1180x820
await gera('navegador-dashboard', navegador(`${T}/pub-dashboard.png`, 'aguas-do-capibaribe.onrender.com · Dashboard', 900, 584));
await gera('navegador-alerta', navegador(`${T}/pub-alerta.png`, 'aguas-do-capibaribe.onrender.com · Alerta 3', 900, 614));
// Circuito do Wokwi: 1758x1575 -> tela 900x806
await gera('navegador-wokwi', navegador(`${T}/circuito-2x.png`, 'wokwi.com · simulador do sensor ESP32', 900, 806));
// Moldura vazada para pôr por cima do vídeo (tela 760x549, proporção 1280x924)
await gera('navegador-video-vazado', navegador(null, 'wokwi.com · sensor de vazão ao vivo', 760, 513), true);
// Celular com o Telegram (702x1430 -> largura útil 368)
await gera('celular-telegram', `<div class="palco"><div class="cel"><div class="ilha"></div><div class="tela2"><div style="height:52px;background:#1B2430"></div><img src="${u(`${DEMO}/06-telegram-alerta.jpg`)}"></div></div></div>`);
await n.close();
