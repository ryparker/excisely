import { test as setup } from '@playwright/test'

const APPLICANT_ACCOUNTS = [
  {
    email: 'labeling@oldtomdistillery.com',
    password: 'applicant123',
    file: 'e2e/.auth/applicant-old-tom.json',
  },
  {
    email: 'legal@napavalleyestate.com',
    password: 'applicant123',
    file: 'e2e/.auth/applicant-napa.json',
  },
  {
    email: 'labels@cascadehop.com',
    password: 'applicant123',
    file: 'e2e/.auth/applicant-cascade.json',
  },
]

const SPECIALIST_AUTH_FILE = 'e2e/.auth/specialist.json'

for (const account of APPLICANT_ACCOUNTS) {
  setup(`authenticate as applicant (${account.email})`, async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })

    await page.getByLabel('Email').fill(account.email)
    await page.keyboard.press('Escape') // dismiss demo accounts dropdown
    await page.getByLabel('Password').fill(account.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for navigation away from login (Neon cold starts can be slow)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 60000,
    })

    await page.context().storageState({ path: account.file })
  })
}

setup('authenticate as specialist', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' })

  await page.getByLabel('Email').fill('dave.morrison@ttb.gov')
  await page.keyboard.press('Escape') // dismiss demo accounts dropdown
  await page.getByLabel('Password').fill('specialist123')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 60000,
  })

  await page.context().storageState({ path: SPECIALIST_AUTH_FILE })
})
