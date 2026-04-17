import { expect, test } from '@playwright/test';

test('muestra la pantalla de login con los campos base', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/Login/i);
  await expect(page.getByText('Ingreso operativo')).toBeVisible();
  await expect(page.getByLabel('Usuario')).toBeVisible();
  await expect(page.getByLabel('Contrasena')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});
