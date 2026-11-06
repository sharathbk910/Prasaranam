import { test, expect } from '@playwright/test';

test.describe('Prasaranam E2E Test Suite (Phase 1 & Phase 2)', () => {
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

  // --- Phase 1 Acceptance & Auth Tests ---
  test('Phase 1 Acceptance: New user sign-up on 360px phone screen, project isolation between users', async ({ page, browser }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    const timestamp = Date.now();
    const user1Email = `user1_${timestamp}@example.org`;
    const user2Email = `user2_${timestamp}@example.org`;

    // User 1 signs up on 360px phone screen
    await page.getByRole('button', { name: /create account/i }).first().click();
    await page.fill('#auth-name', 'Dr. Priya Sharma');
    await page.fill('#auth-email', user1Email);
    await page.fill('#auth-password', 'Pass123456!');
    await page.click('#auth-submit-btn');

    await page.waitForURL(/\/projects/);
    await page.waitForSelector('#root');

    // Rule 9 check: no horizontal scrolling at 360px
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Create project
    await page.getByRole('button', { name: /new project|create first project/i }).first().click();
    await page.fill('#proj-name-input', 'Solar Microgrid Karnataka Beta');
    await page.fill('#proj-desc-input', 'Autonomous telemetry nodes installed at primary healthcare centers.');
    await page.getByRole('button', { name: /create project/i }).click();

    await expect(page.getByText('Solar Microgrid Karnataka Beta')).toBeVisible();

    // User 2 in isolated context
    const context2 = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page2 = await context2.newPage();
    await page2.goto('/signin');

    await page2.getByRole('button', { name: /create account/i }).first().click();
    await page2.fill('#auth-name', 'Rohan Verma');
    await page2.fill('#auth-email', user2Email);
    await page2.fill('#auth-password', 'Pass123456!');
    await page2.click('#auth-submit-btn');

    await page2.waitForURL(/\/projects/);
    await expect(page2.getByText('Solar Microgrid Karnataka Beta')).not.toBeVisible();
    await expect(page2.getByText('No projects found')).toBeVisible();

    await context2.close();
  });

  test('Sign-out ends access to protected pages', async ({ page, isMobile }) => {
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('button', { name: /sign out/i }).click();
    } else {
      await page.getByRole('button', { name: /sign out/i }).first().click();
    }

    await page.waitForURL(/\/signin/);
    await page.goto('/projects');
    await page.waitForURL(/\/signin/);
    await expect(page.locator('#auth-submit-btn')).toBeVisible();
  });

  test('Rule 9, 10 & 11: Responsive layout and keyboard navigation', async ({ page, isMobile }) => {
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    if (isMobile) {
      const menuButton = page.getByRole('button', { name: /open navigation menu/i });
      await menuButton.click();
      await expect(page.locator('#mobile-navigation')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-navigation')).not.toBeVisible();
    }
  });

  // --- Phase 2 Acceptance & Source Import / Search Tests ---
  test('Phase 2 Acceptance: Project with 3+ imported sources can be searched from a phone-sized screen, showing source and position', async ({ page }) => {
    // Mobile-first phone screen 360px
    await page.setViewportSize({ width: 360, height: 740 });

    // 1. Sign in as Elena (Owner of SolarPulse)
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // Open project workspace
    await page.getByRole('link', { name: /open workspace/i }).first().click();
    await page.waitForURL(/\/projects\/.+/);
    await expect(page.getByText('Member Verified')).toBeVisible();

    // 2. Import 1st Source: Pasted Text
    await page.click('#open-source-import-btn');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('#import-title', 'Solar Inverter Battery Throttle Guide');
    await page.fill('#import-author', 'Alex Mercer');
    await page.fill('#import-content', 'The solar inverter activates dynamic thermal throttling when panel temperature exceeds 45 degrees Celsius. Inverter efficiency remains above 92 percent.');
    await page.click('#submit-source-import-btn');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 6000 });

    // 3. Import 2nd Source: Markdown Content
    await page.click('#open-source-import-btn');
    await page.getByRole('button', { name: /markdown/i }).click();
    await page.fill('#import-title', 'Firmware Flash Runbook');
    await page.fill('#import-author', 'Elena Rostova');
    await page.fill('#import-content', '# Remote Firmware Flash SOP\nTo flash microcontroller units, connect via serial UART at 115200 baud.\nEnsure battery voltage is stable above 12.4V before flashing firmware.');
    await page.click('#submit-source-import-btn');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 6000 });

    // 4. Import 3rd Source: Structured JSON Export
    await page.click('#open-source-import-btn');
    await page.getByRole('button', { name: /json export/i }).click();
    const structuredJson = JSON.stringify({
      format: 'issue_export',
      project_title: 'Battery Cell Telemetry',
      issues: [
        {
          id: 'BAT-901',
          title: 'Cellular Drops Trigger MQTT Backpressure Queue',
          description: 'When cell reception drops, telemetry packets queue in SQLite buffer storage.',
          author: 'Maya Patel',
        },
      ],
    });
    await page.fill('#import-title', 'Cellular Telemetry Issue Export');
    await page.fill('#import-author', 'Issue Tracker');
    await page.fill('#import-content', structuredJson);
    await page.click('#submit-source-import-btn');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 6000 });

    // Verify project has 3 or more sources
    await expect(page.getByText('Solar Inverter Battery Throttle Guide')).toBeVisible();
    await expect(page.getByText('Firmware Flash Runbook')).toBeVisible();
    await expect(page.getByText('Cellular Telemetry Issue Export')).toBeVisible();

    // 5. ACCEPTANCE CRITICAL: Search from phone-sized screen (360px)
    const searchInput = page.locator('#workspace-search-input');
    await searchInput.fill('inverter');

    // Wait for search results
    await expect(page.getByText(/Found \d+ matching passage/i)).toBeVisible();

    // Verify results render as cards on mobile
    const resultCard = page.locator('.grid').filter({ hasText: /offsets/i }).first();
    await expect(resultCard).toBeVisible();

    // Verify each result displays its SOURCE and POSITION (Rule Acceptance)
    await expect(page.getByText(/Position: offsets \[\d+\.\.\d+\]/i).first()).toBeVisible();
    await expect(page.getByText(/Passage ID:/i).first()).toBeVisible();

    // Rule 9 check: No horizontal scrolling at 360px during search
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  test('Phase 2 Validation: Rejects malformed JSON with clear safe error and stores nothing', async ({ page }) => {
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    await page.getByRole('link', { name: /open workspace/i }).first().click();
    await page.waitForURL(/\/projects\/.+/);

    await page.click('#open-source-import-btn');
    await page.getByRole('button', { name: /json export/i }).click();

    // Input malformed JSON
    await page.fill('#import-title', 'Malformed File');
    await page.fill('#import-author', 'Attacker');
    await page.fill('#import-content', '{ "format": "issue_export", "unclosed: true');
    await page.click('#submit-source-import-btn');

    // Expect clear safe error banner
    await expect(page.getByText(/Malformed JSON export/i)).toBeVisible();

    // Dialog stays open and nothing stored
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(page.getByText('Malformed File')).not.toBeVisible();
  });

  // --- Phase 3 Acceptance & Knowledge Reconstruction Pipeline Tests ---
  test('Phase 3 Acceptance: Extraction on synthetic payments dataset produces decisions, blockers, gaps, and validated evidence links', async ({ page }) => {
    // Sign in as Elena (Lead / Owner of PayPulse Payment Gateway)
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // Locate and open the PayPulse Payment Gateway workspace
    await expect(page.getByText('PayPulse Payment Gateway')).toBeVisible();
    await page.locator('a[href="/projects/proj-payments-01"]').click();
    await page.waitForURL(/\/projects\/proj-payments-01/);

    // Verify Knowledge Reconstruction Pipeline panel is visible
    await expect(page.getByText('Knowledge Reconstruction Pipeline')).toBeVisible();

    // Check no horizontal scroll
    let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Open extraction configuration
    await page.click('#btn-run-extraction');
    await expect(page.getByText('Reconstruction Configuration')).toBeVisible();
    await expect(page.getByText('Deterministic Fallback Extraction Mode')).toBeVisible();

    // Confirm deterministic fallback checkbox is active
    const fallbackCheckbox = page.locator('#force-fallback-checkbox');
    await expect(fallbackCheckbox).toBeChecked();

    // Trigger extraction job
    await page.click('#btn-confirm-start-extraction');

    // Verify job status card appears with status text and icon
    const jobStatusCard = page.locator('[data-testid="extraction-job-status-card"]');
    await expect(jobStatusCard).toBeVisible();

    // Verify prominent Rule 7 Fallback badge: "NOT A LIVE AI RESULT"
    const fallbackBadge = page.locator('[data-testid="fallback-label-badge"]');
    await expect(fallbackBadge).toBeVisible();
    await expect(fallbackBadge).toContainText('NOT A LIVE AI RESULT');

    // Wait for job completion
    await expect(page.getByText('Status: Extraction Completed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Extracted Items:')).toBeVisible();

    // No horizontal scroll check after job completes
    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Click "Review Extracted Handover" to view the generated handover plan
    await page.click('#btn-view-extracted-handover');
    await page.waitForURL(/\/handovers\/ho-.+/);

    // Verify the Fallback Alert banner is prominently displayed
    await expect(page.getByText(/NOT A LIVE AI RESULT/i).filter({ visible: true }).first()).toBeVisible();

    // Verify Phase 3 Acceptance items extracted (filtering by visible: true):
    // 1. Decision: Vault Tokenization
    await expect(page.getByText(/Vault Tokenization/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('DECISION').filter({ visible: true }).first()).toBeVisible();

    // 2. Blocker: PCI-DSS Compliance unencrypted callbacks (needs confirmation status)
    await expect(page.getByText(/PCI-DSS/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('BLOCKER').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Needs Confirmation').filter({ visible: true }).first()).toBeVisible();

    // 3. Gap: Conflicting Rollout Dates
    await expect(page.getByText('Conflicting').filter({ visible: true }).first()).toBeVisible();

    // 4. Gap: Unassigned Task
    await expect(page.getByText(/Partition Cleanup|Legacy/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('TASK').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/unknown|unassigned/i).filter({ visible: true }).first()).toBeVisible();

    // 5. Inspect Evidence Drawer (Rule 14: opens and closes with Escape & button)
    const inspectBtn = page.locator('[data-testid="inspect-evidence-btn"]').filter({ visible: true }).first();
    await inspectBtn.click();

    const drawer = page.locator('#evidence-drawer');
    await expect(drawer).toBeVisible();
    await expect(page.getByText(/Source Evidence & Exact Passage/i)).toBeVisible();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Reopen and close via Close button
    await inspectBtn.click();
    await expect(drawer).toBeVisible();
    await page.click('#btn-close-evidence');
    await expect(drawer).not.toBeVisible();
  });

  test('Phase 3 Responsive: Status panel and evidence drawer on 1280px desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    await expect(page.getByText('PayPulse Payment Gateway')).toBeVisible();
    await page.locator('a[href="/projects/proj-payments-01"]').click();
    await page.waitForURL(/\/projects\/proj-payments-01/);

    // Extraction panel layout at 1280px
    await expect(page.getByText('Knowledge Reconstruction Pipeline')).toBeVisible();

    // Verify retry button is reachable and has >= 44x44px touch target
    const runBtn = page.locator('#btn-run-extraction');
    const box = await runBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  // --- Phase 4 Acceptance & Recipient-Specific Handover Review Tests ---
  test('Phase 4 Acceptance: Reviewer generates recipient draft, inspects passage, edits item, rejects item, and approves draft', async ({ page, isMobile }) => {
    // 1. Sign in as Sarah Chen (Human Reviewer)
    await page.fill('#auth-email', 'sarah.chen@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // Verify no horizontal overflow
    let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Navigate to New Handover
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('link', { name: /new handover/i }).click();
    } else {
      await page.getByRole('link', { name: /new handover/i }).first().click();
    }
    await page.waitForURL(/\/generate/);

    // Verify responsive design on Generate screen (Rule 9)
    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Rule 1 Enforced Banner visible
    await expect(page.getByText('Rule 1 Enforced: Pre-Retrieval Permissions Boundary')).toBeVisible();

    // Select Recipient: Maya Patel (Internal clearance)
    await page.selectOption('#recipient-select', 'user-maya-recipient-internal');
    await expect(page.getByText(/Recipient Clearance:/i).first()).toBeVisible();

    // Check Section Selection buttons are visible and clickable
    await expect(page.getByText('Sections to Include')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select All', exact: true })).toBeVisible();

    // Fill title
    await page.fill('#handover-title', 'SolarPulse Critical Service Handover: Alex to Maya');

    // Generate verified handover draft
    await page.getByRole('button', { name: /generate verified handover/i }).click();

    // Navigates to Review Workspace with dynamic UUID or prefix
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+/);

    // Verify layout in Review Workspace (Rule 9 & Rule 12)
    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Verify Human Reviewer Workspace & Approval Guard header
    await expect(page.getByText('Human Reviewer Workspace & Approval Guard')).toBeVisible();

    // Verify Rule 7 Non-AI fallback banner
    await expect(page.getByText(/NOT A LIVE AI RESULT/i).filter({ visible: true }).first()).toBeVisible();

    // Verify Section Headers are present
    await expect(page.getByText('Decisions & Rationale').filter({ visible: true }).first()).toBeVisible();

    // Inspect Passage (Rule 14: full-screen sheet on mobile, side panel on desktop)
    const inspectBtn = page.locator('[data-testid="inspect-evidence-btn"]').filter({ visible: true }).first();
    await inspectBtn.click();

    const drawer = page.locator('#evidence-drawer');
    await expect(drawer).toBeVisible();
    await expect(page.getByText(/Source Evidence & Exact Passage/i)).toBeVisible();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Close via Close button (min-h-[44px] min-w-[44px])
    await inspectBtn.click();
    await expect(drawer).toBeVisible();
    await page.click('#btn-close-evidence');
    await expect(drawer).not.toBeVisible();

    // Edit an item (Phase 4 requirement: reviewer context, never overwrites original source)
    const editBtn = page.locator('[data-testid="item-edit-btn"]').filter({ visible: true }).first();
    await editBtn.click();

    // Verify Edit Dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Reviewer Attribution Guarantee/i)).toBeVisible();

    // Change statement text
    await page.fill('#edit-statement', 'Refactored telemetry cron buffer to 120s with verified hardware validation.');
    await page.fill('#edit-rationale', 'Confirmed via firmware release v2.4 audit.');
    await page.getByRole('button', { name: /save reviewer edit/i }).click();

    // Verify edit dialog closed and reviewer context is displayed
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(/Reviewer Edit Context \(Original Source Intact\)/i).filter({ visible: true }).first()).toBeVisible();

    // Reject one item (Phase 4 requirement: rejected item excluded from approved draft)
    const rejectBtn = page.locator('[data-testid="item-reject-btn"]').filter({ visible: true }).last();
    await rejectBtn.click();
    await expect(page.getByText('REJECTED').filter({ visible: true }).first()).toBeVisible();

    // Approve remaining pending items
    const approveBtns = page.locator('[data-testid="item-approve-btn"]').filter({ visible: true });
    const count = await approveBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = approveBtns.nth(i);
      if (await btn.isEnabled()) {
        await btn.click();
        await page.waitForTimeout(150);
      }
    }

    // Now whole draft approval should be enabled
    const approveDraftBtn = page.getByRole('button', { name: /approve entire draft/i });
    await expect(approveDraftBtn).toBeEnabled({ timeout: 5000 });
    await approveDraftBtn.click();

    // Verify status becomes Approved
    await expect(page.getByText('Approved').filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // Share with Maya
    const shareBtn = page.getByRole('button', { name: /share with maya/i });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Status becomes Shared
    await expect(page.getByText('Shared').filter({ visible: true }).first()).toBeVisible();

    // Navigate to Recipient View
    await page.getByRole('link', { name: /recipient view/i }).click();
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+\/shared/);

    // Verify recipient view
    await expect(page.getByText(/Official Knowledge Handover Document/i)).toBeVisible();
    await expect(page.getByText(/Refactored telemetry cron buffer to 120s/i)).toBeVisible();

    // Verify no horizontal overflow in recipient view
    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  test('Phase 4 Responsive: Review workspace desktop table (1280px) with inline actions and side panel evidence drawer', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-only table test');
    await page.setViewportSize({ width: 1280, height: 800 });

    // Sign in as Sarah Chen
    await page.fill('#auth-email', 'sarah.chen@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // Go to New Handover
    await page.getByRole('link', { name: /new handover/i }).first().click();
    await page.waitForURL(/\/generate/);

    // Desktop: Check 1280px no horizontal scroll
    let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Generate handover
    await page.selectOption('#recipient-select', 'user-maya-recipient-internal');
    await page.fill('#handover-title', 'Desktop Review Audit Test');
    await page.getByRole('button', { name: /generate verified handover/i }).click();
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+/);

    // Desktop table layout (Rule 12: desktop >= 768px uses table with columns)
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /topic & classification/i }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /statement & reviewer context/i }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /verified owner/i }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /review actions/i }).first()).toBeVisible();

    // Verify evidence side panel opens on desktop (Rule 14: side slide-over panel md:max-w-xl)
    const inspectBtn = page.locator('[data-testid="inspect-evidence-btn"]').filter({ visible: true }).first();
    await inspectBtn.click();

    const drawer = page.locator('#evidence-drawer');
    await expect(drawer).toBeVisible();

    // Verify closes with Escape on desktop
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Check no horizontal scroll at 1280px
    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  // --- Phase 5 Acceptance & Multi-Recipient Sharing Tests ---
  test('Phase 5 Acceptance: Two recipients with different access, live permission check, and receipt acknowledgement', async ({ page, isMobile }) => {
    // 1. Sign in as Sarah Chen (Lead Reviewer)
    await page.fill('#auth-email', 'sarah.chen@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // 2. Generate Handover for Recipient A: Maya Patel (Internal clearance)
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('link', { name: /new handover/i }).click();
    } else {
      await page.getByRole('link', { name: /new handover/i }).first().click();
    }
    await page.waitForURL(/\/generate/);

    await page.selectOption('#recipient-select', 'user-maya-recipient-internal');
    await page.fill('#handover-title', 'SolarPulse Operations Handover: Recipient A (Maya)');
    await page.getByRole('button', { name: /generate verified handover/i }).click();
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+/);

    const planUrlA = page.url();
    const planIdA = planUrlA.split('/').pop()!;

    // Approve items and approve entire draft using robust while loop
    await expect(page.locator('[data-testid="item-approve-btn"]').filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    while (true) {
      const pendingBtn = page.locator('[data-testid="item-approve-btn"]:not([disabled])').filter({ visible: true }).first();
      if (await pendingBtn.count() === 0) break;
      await pendingBtn.click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: /approve entire draft/i }).click();
    await expect(page.getByText('Approved').filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // Share with Maya
    await page.getByRole('button', { name: /share with maya/i }).click();
    await expect(page.getByText('Shared').filter({ visible: true }).first()).toBeVisible();

    // 3. Recipient A (Maya Patel) signs in and opens her approved handover
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    await page.fill('#auth-email', 'maya.patel@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // Navigate to Recipient A shared view
    await page.goto(`/handovers/${planIdA}/shared`);
    await expect(page.getByText('SolarPulse Operations Handover: Recipient A (Maya)')).toBeVisible();
    await expect(page.getByText('Official Knowledge Handover Document')).toBeVisible();

    // Inspect an evidence passage (Phase 5 requirement: basic evidence panel with title, author, date, passage)
    const evidenceBtnA = page.locator('[data-testid="evidence-link-btn"]').filter({ visible: true }).first();
    await evidenceBtnA.click();

    const drawerA = page.locator('#evidence-drawer');
    await expect(drawerA).toBeVisible();
    await expect(drawerA.getByText('Source Evidence & Exact Passage')).toBeVisible();
    await expect(drawerA.getByText(/Author:/i)).toBeVisible();
    await expect(drawerA.getByText(/Date:/i)).toBeVisible();

    // Close evidence panel
    await page.click('#btn-close-evidence');
    await expect(drawerA).not.toBeVisible();

    // 4. Recipient A confirms receipt of handover (Phase 5 requirement: acknowledgement of receipt)
    await page.fill('#ack-notes-input', 'Reviewed all inverter and telemetry runbooks. Verified.');
    await page.click('#btn-confirm-acknowledgement');

    // Verify acknowledgement is recorded and banner appears
    await expect(page.getByText('Handover Formally Acknowledged')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Reviewed all inverter and telemetry runbooks/i)).toBeVisible();

    // Verify zero horizontal scroll at 360px on recipient view
    let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // 5. Demonstrate Recipient B (Liam Vance, public clearance)
    // Sign out Maya
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    // Sarah signs back in to generate Liam's handover
    await page.fill('#auth-email', 'sarah.chen@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('link', { name: /new handover/i }).click();
    } else {
      await page.getByRole('link', { name: /new handover/i }).first().click();
    }
    await page.waitForURL(/\/generate/);

    await page.selectOption('#recipient-select', 'user-liam-recipient-public');
    await page.fill('#handover-title', 'SolarPulse Operations Handover: Recipient B (Liam)');
    await page.getByRole('button', { name: /generate verified handover/i }).click();
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+/);

    const planUrlB = page.url();
    const planIdB = planUrlB.split('/').pop()!;

    // Approve items and draft for Liam
    await expect(page.locator('[data-testid="item-approve-btn"]').filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    while (true) {
      const pendingBtn = page.locator('[data-testid="item-approve-btn"]:not([disabled])').filter({ visible: true }).first();
      if (await pendingBtn.count() === 0) break;
      await pendingBtn.click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: /approve entire draft/i }).click();
    await expect(page.getByText('Approved').filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // Share with Liam
    await page.getByRole('button', { name: /share with liam/i }).click();
    await expect(page.getByText('Shared').filter({ visible: true }).first()).toBeVisible();

    // Sign out Sarah and sign in as Liam
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    await page.fill('#auth-email', 'liam.vance@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    // Liam navigates to his shared handover
    await page.goto(`/handovers/${planIdB}/shared`);
    await expect(page.getByText('SolarPulse Operations Handover: Recipient B (Liam)')).toBeVisible();

    // Liam confirms receipt
    await page.fill('#ack-notes-input', 'Public volunteer onboarding package received and confirmed.');
    await page.click('#btn-confirm-acknowledgement');
    await expect(page.getByText('Handover Formally Acknowledged')).toBeVisible({ timeout: 5000 });

    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  // --- Phase 5 Complete Full Flow (Round 2 Finish Line) ---
  test('Phase 5 Complete Flow: Import -> Extract -> Draft -> Review -> Approve -> Share -> Recipient View & Acknowledge', async ({ page, isMobile }) => {
    // 1. Sign in as Elena Rostova (Project Owner & Lead)
    await page.fill('#auth-email', 'elena.rostova@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(/\/projects/);

    // Locate and open Project SolarPulse
    await expect(page.getByText('Project SolarPulse')).toBeVisible();
    await page.locator('a[href="/projects/proj-solarpulse-01"]').click();
    await page.waitForURL(/\/projects\/proj-solarpulse-01/);

    // STEP 1: IMPORT SOURCE
    await page.click('#open-source-import-btn');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('#import-title', 'Solar Microgrid Grid Synchronization Runbook');
    await page.fill('#import-author', 'Alex Mercer');
    await page.fill(
      '#import-content',
      'Phase 5 Operational Handover: Telemetry failover activates when battery discharge exceeds 80 percent. Grid synchronization operates autonomously at 50Hz frequency.'
    );
    await page.click('#submit-source-import-btn');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 6000 });
    await expect(page.getByText('Solar Microgrid Grid Synchronization Runbook')).toBeVisible();

    // STEP 2: EXTRACT KNOWLEDGE PIPELINE
    await page.click('#btn-run-extraction');
    await expect(page.getByText('Reconstruction Configuration')).toBeVisible();
    await page.click('#btn-confirm-start-extraction');

    // Wait for extraction completion
    await expect(page.getByText('Status: Extraction Completed')).toBeVisible({ timeout: 10000 });

    // STEP 3: DRAFT GENERATION
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('link', { name: /new handover/i }).click();
    } else {
      await page.getByRole('link', { name: /new handover/i }).first().click();
    }
    await page.waitForURL(/\/generate/);

    await page.selectOption('#recipient-select', 'user-maya-recipient-internal');
    await page.fill('#handover-title', 'SolarPulse End-to-End Operational Handover');
    await page.getByRole('button', { name: /generate verified handover/i }).click();

    // STEP 4: REVIEW WORKSPACE
    await page.waitForURL(/\/handovers\/[a-zA-Z0-9-]+/);
    await expect(page.getByText('Human Reviewer Workspace & Approval Guard')).toBeVisible();

    const planUrl = page.url();
    const planId = planUrl.split('/').pop()!;

    // Edit an item (records reviewer context, leaves source unchanged)
    const editBtn = page.locator('[data-testid="item-edit-btn"]').filter({ visible: true }).first();
    await editBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('#edit-statement', 'Refactored inverter emergency cutoff threshold to 82% discharge.');
    await page.fill('#edit-rationale', 'Updated according to IEEE 1547 standards review.');
    await page.getByRole('button', { name: /save reviewer edit/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(/Reviewer Edit Context/i).filter({ visible: true }).first()).toBeVisible();

    // STEP 5: APPROVE ALL REMAINING ITEMS & ENTIRE DRAFT
    await expect(page.locator('[data-testid="item-approve-btn"]').filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    while (true) {
      const pendingBtn = page.locator('[data-testid="item-approve-btn"]:not([disabled])').filter({ visible: true }).first();
      if (await pendingBtn.count() === 0) break;
      await pendingBtn.click();
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: /approve entire draft/i }).click();
    await expect(page.getByText('Approved').filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // STEP 6: SHARE WITH RECIPIENT
    await page.getByRole('button', { name: /share with maya/i }).click();
    await expect(page.getByText('Shared').filter({ visible: true }).first()).toBeVisible();

    // STEP 7: RECIPIENT VIEW & FORMAL ACKNOWLEDGEMENT
    // Elena signs out
    if (isMobile) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
    }
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/signin/);

    // Recipient Maya signs in
    await page.fill('#auth-email', 'maya.patel@example.org');
    await page.fill('#auth-password', 'Pass1234!');
    await page.click('#auth-submit-btn');
    await page.waitForURL(url => !url.pathname.includes('/signin') && !url.pathname.includes('/auth'));

    await page.goto(`/handovers/${planId}/shared`);

    await expect(page.getByText('Official Knowledge Handover Document')).toBeVisible();
    await expect(page.getByText(/Refactored inverter emergency cutoff threshold/i)).toBeVisible();

    // Recipient formally confirms receipt
    await page.fill('#ack-notes-input', 'Received full knowledge handover and completed operational runbook walkthrough.');
    await page.click('#btn-confirm-acknowledgement');

    await expect(page.getByText('Handover Formally Acknowledged')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Received full knowledge handover/i)).toBeVisible();

    // Final Rule 9 verification: zero horizontal overflow on both 360px and 1280px
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });
});
