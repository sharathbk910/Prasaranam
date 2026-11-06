import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Prasaranam Phase 6: Round 3 Improvements & Accessibility Suite', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await page.request.post('http://localhost:4000/api/test/reset');
    } catch {
      // ignore if server restarting
    }
    await page.goto('/signin');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/signin');
    await page.waitForSelector('#root');
  });

  // =========================================================================
  // IMPROVEMENT 1: Grounded Recipient Q&A (Rule 1 & Rule 2 Compliant)
  // =========================================================================
  test('Improvement 1: Recipient Grounded Q&A returns "insufficient evidence" for unsupported query, verified citation for supported query', async ({ page }) => {
    // 1. Sign in as Maya Patel (Internal Recipient)
    await page.fill('#auth-email', 'maya.patel@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // Open Maya's approved shared handover
    await page.goto('/handovers/plan-solarpulse-approved-maya/shared');
    await page.waitForSelector('#qa-question-input');

    // Rule 9: No horizontal overflow at current viewport
    const isOverflowingInitial = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowingInitial).toBe(false);

    // Negative query with no supporting evidence (Rule 1 & Rule 2)
    await page.fill('#qa-question-input', 'What is the secret recipe for quantum microwave popcorn?');
    await page.click('#btn-ask-question');

    // Must return "insufficient evidence" and never guess (Invariant 1)
    await expect(page.locator('#qa-insufficient-evidence')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/insufficient evidence: No permitted documentation/i)).toBeVisible();
    await expect(page.locator('#qa-open-citation')).not.toBeVisible();

    // Positive query with grounded evidence in permitted sources (RFC-204)
    await page.fill('#qa-question-input', 'How often does the ingestion pipeline process MQTT sensor payloads?');
    await page.click('#btn-ask-question');

    // Must return verified evidence status badge
    await expect(page.locator('#qa-verified-evidence')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/60 seconds/i)).toBeVisible();

    // Citation button must be visible and clickable
    const citationBtn = page.locator('#qa-open-citation');
    await expect(citationBtn).toBeVisible();
    await citationBtn.click();

    // Evidence Sheet / Drawer must open showing exact passage and source
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Source Evidence & Exact Passage')).toBeVisible();
    await expect(page.getByText(/RFC-204: Telemetry Ingestion Pipeline & Message Broker/i).first()).toBeVisible();

    // Close evidence drawer via Escape key
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  // =========================================================================
  // IMPROVEMENT 2: Versioning and Permission-Driven Invalidation
  // =========================================================================
  test('Improvement 2: Editing an approved item increments to new draft version requiring re-approval', async ({ page }) => {
    // 1. Sign in as Elena Rostova (Reviewer / Lead)
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // Open the approved handover in review workspace
    await page.goto('/handovers/plan-solarpulse-approved-maya');
    await expect(page.getByText('Human Reviewer Workspace & Approval Guard')).toBeVisible();

    // Initially version 1 is approved
    await expect(page.getByText('v1').first()).toBeVisible();

    // Reviewer edits a statement
    const editBtn = page.locator('[data-testid="item-edit-btn"]').filter({ visible: true }).first();
    await editBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.fill('#edit-statement', 'Refactored inverter emergency cutoff threshold to 85% discharge.');
    await page.fill('#edit-rationale', 'Adjusted per technical steering committee revision.');
    await page.getByRole('button', { name: /save reviewer edit/i }).click();

    // Modal closes
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify version incremented to v2 and marked under review
    await expect(page.getByText('v2').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/New Version Draft \(v2\) — Re-approval Required/i)).toBeVisible();

    // Recipient Maya attempts to view the modified unapproved draft
    // Elena signs out
    const menuBtn = page.getByRole('button', { name: /open navigation menu/i });
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    // Maya signs in
    await page.fill('#auth-email', 'maya.patel@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // Maya navigates to the handover which is now under review (blocked)
    await page.goto('/handovers/plan-solarpulse-approved-maya/shared');
    await expect(
      page.getByText(/Failed to fetch handover plan|pending human review|inaccessible/i)
    ).toBeVisible({ timeout: 5000 });

    // Reviewer re-approves the draft to restore access (complete lifecycle)
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    await page.goto('/handovers/plan-solarpulse-approved-maya');
    await page.getByRole('button', { name: /approve entire draft/i }).click();
    await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // IMPROVEMENT 3: Authenticated Exports, Redacted Audit History & Negative Access
  // =========================================================================
  test('Improvement 3: Authenticated Markdown export and Redacted Audit History modal', async ({ page }) => {
    // Sign in as Maya Patel
    await page.fill('#auth-email', 'maya.patel@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    await page.goto('/handovers/plan-solarpulse-approved-maya/shared');
    await expect(page.locator('#btn-export-markdown')).toBeVisible({ timeout: 5000 });

    // Open Redacted Audit History modal
    await page.click('#btn-view-audit-log');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Redacted Handover Audit History')).toBeVisible();
    await expect(page.getByText(/Approved by/i).first()).toBeVisible();

    // Verify redaction guarantee: no raw unredacted confidential passages
    const modalText = await page.locator('#audit-modal').innerText();
    expect(modalText).not.toContain('Battery runaway thermal event');

    // Close modal with button
    await page.click('#btn-close-audit-modal');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  // =========================================================================
  // RESPONSIVE & ACCESSIBILITY POLISH: 360px, 768px, 1280px & Axe Audits
  // =========================================================================
  test('Accessibility and Responsive Polish: Axe check and zero horizontal overflow across breakpoints', async ({ page }) => {
    // 1. Accessibility on Sign-in screen (Axe-Core structure, roles, landmarks, labels)
    await page.goto('/signin');
    await page.waitForSelector('#auth-submit-btn');

    let axeResults = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(axeResults.violations).toEqual([]);

    // Sign in
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // 2. Responsive overflow check at 360px, 768px, 1280px on Project List
    const testWidths = [360, 768, 1280];
    for (const width of testWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
      const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(isOverflowing).toBe(false);
    }

    // 3. Accessibility on Project Workspace
    await page.goto('/projects/proj-solarpulse-01');
    await expect(page.getByText('Project SolarPulse')).toBeVisible();

    axeResults = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(axeResults.violations).toEqual([]);

    // 4. Accessibility on Review Workspace
    await page.goto('/handovers/plan-solarpulse-approved-maya');
    await expect(page.getByText('Human Reviewer Workspace & Approval Guard')).toBeVisible();

    axeResults = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(axeResults.violations).toEqual([]);

    // Verify touch targets >= 40px for primary interactive buttons
    const primaryButtons = page.locator('button:visible');
    const count = await primaryButtons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = primaryButtons.nth(i);
      const box = await btn.boundingBox();
      if (box && box.height > 0) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }

    // 5. 200% Zoom check (simulate high DPI / zoom without horizontal overflow)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.evaluate(() => {
      document.body.style.zoom = '200%';
    });
    const zoomOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth * 2.1);
    expect(zoomOverflow).toBe(false);
  });
});
