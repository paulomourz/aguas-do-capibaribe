import ExcelJS from 'exceljs'
import { expect, test } from '@playwright/test'
import { instalarApiFalsa } from './apiFalsa'

/*
 * Exportação do relatório em planilha Excel (issue #159):
 *   Given o gestor na tela de relatórios com o período escolhido,
 *   When aciona "Exportar para Excel (.xlsx)",
 *   Then baixa um .xlsx com o cabeçalho da empresa, fórmulas de soma de volume e a pegada hídrica.
 * O arquivo baixado é aberto com o ExcelJS para conferir o conteúdo.
 */

test('gestor exporta o relatório do mês em planilha Excel', async ({ page, context }) => {
  const api = await instalarApiFalsa(context, { perfil: 'gestor' })
  const agora = new Date()
  const noMes = (dia: number) => new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), dia, 15)).toISOString()
  const base = { usuarioId: 3 }
  api.lotes.push(
    { ...base, id: 1, processoId: 1, pecas: 120, litros: 760, esperado: 800, desvio: -5, statusConformidade: 'DENTRO_DA_META', data: noMes(1) },
    { ...base, id: 2, processoId: 2, pecas: 100, litros: 1350, esperado: 1200, desvio: 12.5, statusConformidade: 'CRITICO', data: noMes(2) },
    { ...base, id: 3, processoId: 1, pecas: 80, litros: 830, esperado: 800, desvio: 3.75, statusConformidade: 'ATENCAO', data: noMes(3) },
  )

  await page.goto('/#/login')
  await page.locator('#usuario').fill('gestor.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/#/relatorios')

  const botao = page.getByRole('button', { name: 'Exportar para Excel (.xlsx)' })
  await expect(botao).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent('download'), botao.click()])

  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0')
  expect(download.suggestedFilename()).toBe(`aguas-do-capibaribe-relatorio-${agora.getUTCFullYear()}-${mes}.xlsx`)
  await expect(page.getByText(`${download.suggestedFilename()} baixado.`)).toBeVisible()

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(await download.path())
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Lotes', 'Resumo por processo'])

  const lotes = wb.getWorksheet('Lotes')!
  expect(lotes.getCell('A1').value).toBe('Águas do Capibaribe · Lotes do período')
  expect(String(lotes.getCell('A4').value)).toContain('por Gestora Teste')
  expect([7, 8, 9].map((n) => lotes.getCell(`A${n}`).value)).toEqual(['1', '2', '3'])
  expect([7, 8, 9].map((n) => lotes.getCell(`I${n}`).value)).toEqual(['Dentro da meta', 'Crítico', 'Atenção'])
  // Soma de volume e pegada hídrica do período, como fórmulas.
  expect(lotes.getCell('F10').value).toMatchObject({ formula: 'SUM(F7:F9)', result: 2940 })
  expect(lotes.getCell('J10').value).toMatchObject({ formula: 'IF(D10=0,"",F10/D10)' })
  expect((lotes.getCell('J10').value as { result: number }).result).toBeCloseTo(2940 / 300)
})

test('sem lotes no mês, o botão da planilha fica desabilitado', async ({ page, context }) => {
  await instalarApiFalsa(context, { perfil: 'gestor' })
  await context.route('**/api/relatorios/resumo**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('/#/login')
  await page.locator('#usuario').fill('gestor.teste')
  await page.locator('#senha').fill('qualquer-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto('/#/relatorios')

  await expect(page.getByText('Sem lotes neste período')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportar para Excel (.xlsx)' })).toBeDisabled()
})
