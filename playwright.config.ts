import { defineConfig } from '@playwright/test';

// Development-only browser tooling. Chromium uses software WebGL 2 in this VM;
// these tests make no claim about physical-phone GPU performance.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'touch-360x640', testIgnore: [/standalone\.spec\.ts/, /soak\.spec\.ts/], use: { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'touch-390x844', testIgnore: [/standalone\.spec\.ts/, /soak\.spec\.ts/], use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
    { name: 'touch-768x1024', testIgnore: [/standalone\.spec\.ts/, /soak\.spec\.ts/], use: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'mouse-1280x720', testIgnore: /standalone\.spec\.ts/, use: { viewport: { width: 1280, height: 720 }, hasTouch: false, deviceScaleFactor: 1 } },
    { name: 'standalone-touch', testMatch: /standalone\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'standalone-mouse', testMatch: /standalone\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 720 }, hasTouch: false, deviceScaleFactor: 1 } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run build:playable && npm run preview:playable', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120_000 },
  ],
});
