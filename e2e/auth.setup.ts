import { test as setup } from '@playwright/test'

const APPLICANT_AUTH_FILE = 'e2e/.auth/applicant.json'
const SPECIALIST_AUTH_FILE = 'e2e/.auth/specialist.json'

setup('authenticate as applicant', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('labeling@oldtomdistillery.com')
  await page.getByLabel('Password').fill('applicant123')
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to app
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  })

  await page.context().storageState({ path: APPLICANT_AUTH_FILE })
})

setup('authenticate as specialist', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('dave.morrison@ttb.gov')
  await page.getByLabel('Password').fill('specialist123')
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to app
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  })

  await page.context().storageState({ path: SPECIALIST_AUTH_FILE })
})
