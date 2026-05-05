import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const BASE_ORIGIN = new URL(BASE_URL).origin;

let pageErrors: string[] = [];
let failedResponses: string[] = [];
// Routes sourced from App.tsx (static paths only). Keep this list current
// when adding or removing routes so the audit stays meaningful.
const routes = [
  '/',
  '/properties',
  '/maintenance',
  '/messages',
  '/tenants',
  '/property-owners',
  '/house-watching',
  '/property-check',
  '/finances',
  '/documents',
  '/settings',
  '/activity',
  '/user-management',
  '/admin-navigation',
  '/property-manager-dashboard',
  '/profile',
  // Workflow engine dev routes (outside auth gate)
  '/workflows-demo',
  '/mobile/house-check',
  // Public routes
  '/auth',
  '/setup',
] as const;

// Enable emergency admin bypass (read by src/components/ProtectedRoute.tsx in
// DEV) and attach error listeners before each test.
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  failedResponses = [];

  page.on('pageerror', (err) => {
    pageErrors.push(`pageerror: ${err?.message || String(err)}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      pageErrors.push(`console.${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('response', (response) => {
    try {
      const url = new URL(response.url());
      if (url.origin === BASE_ORIGIN && response.status() >= 500) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    } catch {
      // ignore invalid URLs
    }
  });

  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('emergencyAdmin', 'true');
    } catch {
      // sessionStorage may be unavailable in some contexts; ProtectedRoute
      // also checks a window global, but we don't set that here.
    }
  });
});

// Helper to assert that a page did not render the SPA 404
async function expectNo404(page: import('@playwright/test').Page) {
  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  expect(h1Text?.trim().toLowerCase()).not.toBe('404');
  const bodyText = await page.locator('body').textContent();
  expect(bodyText && bodyText.length).toBeTruthy();
}

// 1) Route audit: every declared route should render without SPA 404
test('Route audit: all static routes render', async ({ page }) => {
  for (const route of routes) {
    const url = new URL(route, BASE_URL).toString();
    await page.goto(url, { waitUntil: 'load' });
    await expectNo404(page);
  }
  expect(pageErrors, `Console/runtime errors detected:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(failedResponses, `Same-origin 5xx responses detected:\n${failedResponses.join('\n')}`).toEqual([]);
});

// 2) Link crawl audit: traverse internal links found on each page and ensure they don't 404
//    This helps catch broken or outdated links without manual clicking
test('Link audit: internal links discovered on pages should not 404', async ({ page }) => {
  const maxLinksPerPage = 25;

  for (const route of routes) {
    const startUrl = new URL(route, BASE_URL).toString();
    await page.goto(startUrl, { waitUntil: 'load' });
    await expectNo404(page);

    // Collect internal links from current page
    const hrefs = await page.$$eval('a[href^="/"]', (els) =>
      Array.from(new Set(
        els
          .map((el) => (el as HTMLAnchorElement).getAttribute('href') || '')
          .filter((h) => !!h && h.startsWith('/') && !h.startsWith('//') && !h.includes('#'))
      ))
    );

    // Limit and avoid re-testing the same route
    const uniqueTargets = hrefs
      .filter((h) => h !== route)
      .slice(0, maxLinksPerPage);

    for (const href of uniqueTargets) {
      const targetUrl = new URL(href, BASE_URL).toString();
      await page.goto(targetUrl, { waitUntil: 'load' });
      await expectNo404(page);
    }
  }

  expect(pageErrors, `Console/runtime errors detected during link crawl:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(failedResponses, `Same-origin 5xx responses detected during link crawl:\n${failedResponses.join('\n')}`).toEqual([]);
});
