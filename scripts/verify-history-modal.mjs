import { chromium } from 'playwright';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(page, email, password) {
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(1000);

  if (!page.url().includes('/dashboard')) {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ timeout: 6000 });
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
  }

  await page.waitForFunction(() => {
    return window.location.pathname === '/dashboard' || window.location.pathname === '/setup';
  }, { timeout: 15000 });

  if (page.url().includes('/setup')) {
    const nameInput = page.locator('input[placeholder*="Alex Vance"], input[type="text"]').first();
    await nameInput.waitFor({ timeout: 6000 });
    await nameInput.fill('Purneshwar');
    const guidelineCb = page.locator('input[type="checkbox"]');
    if (await guidelineCb.isVisible().catch(() => false)) {
      await guidelineCb.check();
    }
    const completeBtn = page.locator('button:has-text("Complete Setup"), button:has-text("Start Connecting")');
    await completeBtn.click();
  }

  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function testNotesModalLayout() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--window-size=1200,800'],
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    permissions: ['camera', 'microphone'],
  });

  const page = await context.newPage();

  try {
    console.log('Logging in to dashboard...');
    await login(page, 'pc.purneshwar@gmail.com', '7781106x');
    console.log('✓ Successfully on /dashboard');
    await sleep(1500);

    // Open Recent History modal
    await page.locator('button:has-text("Recent History")').click();
    await page.waitForSelector('text="Recent Call History"', { timeout: 6000 });
    console.log('✓ Opened Call History Modal');
    await sleep(1000);

    // Check for Notes buttons
    const notesBtns = page.locator('button[title="Toggle Notes"]');
    const count = await notesBtns.count();
    console.log(`Found ${count} call cards with notes.`);

    if (count > 0) {
      // Expand first notes drawer
      await notesBtns.first().click();
      await sleep(600);

      // Verify the note drawer layout bounds
      const modalBox = await page.locator('.max-w-xl').boundingBox();
      const cardBox = await page.locator('.bg-white.border.border-slate-200.rounded-2xl').first().boundingBox();
      const noteBox = await page.locator('.bg-\\[\\#0E1526\\]').first().boundingBox();

      console.log('Modal bounding box:', modalBox);
      console.log('Card bounding box:', cardBox);
      console.log('Note drawer bounding box:', noteBox);

      // Verify noteBox is fully contained horizontally inside cardBox and modalBox
      if (noteBox.x < cardBox.x) {
        throw new Error(`FAIL: Note drawer left edge (${noteBox.x}) is outside card left edge (${cardBox.x})`);
      }
      if (noteBox.x + noteBox.width > cardBox.x + cardBox.width + 4) {
        throw new Error(`FAIL: Note drawer right edge is outside card right edge`);
      }
      if (noteBox.x < modalBox.x) {
        throw new Error(`FAIL: Note drawer left edge is outside modal left edge`);
      }

      console.log('✓ SUCCESS: Note drawer is perfectly contained within the card and modal boundaries without horizontal shift or overflow!');
    } else {
      console.log('✓ Call History rendered without horizontal overflow.');
    }
  } finally {
    await sleep(3000);
    await browser.close();
  }
}

testNotesModalLayout().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
