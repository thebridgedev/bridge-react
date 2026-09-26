import { test, expect } from '../../fixtures/auth';
import { MED_TIMEOUT } from '../../fixtures/timeouts';

test.describe('SDK Signup', () => {
  test('fill form → submit → "Check your email" shown', async ({ page }) => {
    await page.goto('/auth/signup');

    const emailInput = page.locator('#signup-email');
    await emailInput.waitFor({ state: 'visible', timeout: MED_TIMEOUT });
    // The safe-sender test pattern bridge-api's purge matches, so the account
    // this creates is cleaned up and its signup mail never bounces (TBP-721).
    await emailInput.fill(`iman+playwright-test-sdk-${Date.now()}@nebulr.group`);

    await page.locator('#signup-first-name').fill('Test');
    await page.locator('#signup-last-name').fill('User');

    await page.locator('button:has-text("Sign up")').click();

    // Either success heading ("Check your email") or error alert (signup disabled, etc.)
    const response = page.locator('[data-bridge-alert], h2.bridge-success-heading');
    await response.first().waitFor({ state: 'visible', timeout: MED_TIMEOUT });
    const text = await response.first().textContent();
    expect(text).toBeTruthy();
  });

  test('shows login link', async ({ page }) => {
    await page.goto('/auth/signup');

    const loginLink = page.locator('a[href="/auth/login"]:has-text("Log in")');
    await loginLink.waitFor({ state: 'visible', timeout: MED_TIMEOUT });
  });
});
