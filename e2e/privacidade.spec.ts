import { expect, test } from '@playwright/test'

/*
 * Critério de aceitação da issue #117 (LGPD, RNF27):
 * Given qualquer pessoa na tela de login, When abrir o aviso de privacidade,
 * Then vê quais dados são guardados, para quê e por quanto tempo.
 */
test('na tela de login, qualquer pessoa abre o aviso de privacidade e vê os dados, a finalidade e o prazo', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('link', { name: 'Aviso de privacidade' }).first().click()

  await expect(page).toHaveURL(/#\/privacidade$/)
  await expect(page.getByRole('heading', { name: 'Aviso de privacidade' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quais dados são guardados' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nome', exact: true })).toBeVisible()
  await expect(page.getByText('Para quê').first()).toBeVisible()
  await expect(page.getByText('Por quanto tempo').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Com quem falar' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar para o login' }).click()
  await expect(page.getByRole('heading', { name: 'Acesse sua lavanderia' })).toBeVisible()
})
