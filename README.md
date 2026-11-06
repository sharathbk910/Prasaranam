# Prasaranam — Verifiable AI-Powered Knowledge Handover System

Prasaranam reconstructs project states from authorized sources when a student, volunteer, or employee leaves a project, producing a recipient-specific, verifiable handover document. Every important statement links to its exact source passage. Uncertain or conflicting information is labeled, never filled in. A human reviewer approves the handover before it is shared.

---

## Core Invariants & Architectural Rules

1. **Rule 1: Pre-Prompt Permission Filtering**: Clearance boundaries are applied to sources and passages **before** building AI prompts or retrieving Q&A context. Restricted content never reaches the model or an unauthorized recipient.
2. **Rule 2: Untrusted Data Isolation**: All imported content is treated as untrusted user data. Handover items cannot approve records, and prompt instructions within imported texts are ignored.
3. **Rule 3: Server-Side API Security**: Gemini API keys live exclusively on the server (`server/src/services/geminiService.ts`). Keys are never bundled or exposed to the browser.
4. **Rule 4: Verbatim Quotation Validation**: Every extracted item must reference valid chunk IDs and contain an exact substring match (`verifyQuotation`). Citations are never repaired by guessing.
5. **Rule 5: Attribution-Based Ownership**: Owners are only recognized when explicitly assigned by source passages, never inferred from message authorship alone. Unassigned tasks are labeled with owner `unknown`.
6. **Rule 6: Discrete Verification Labels**: Confidence percentages are prohibited. Statements use explicit textual labels: `supported`, `corroborated`, `needs confirmation`, `conflicting`, `unknown`.
7. **Rule 7: Non-AI Deterministic Fallback**: A built-in rule-based fallback guarantees offline operation and testing. Fallback outputs are visibly labeled `NON-AI DETERMINISTIC FALLBACK (NOT A LIVE AI RESULT)`.
8. **Rule 8: Synthetic Data Only**: Uses synthetic demo projects (SolarPulse microgrid telemetry, PayPulse payment gateway, Arogya Mitra logistics).
9. **Rules 9–15: Mobile-First Responsive Design**: Built for a 360px-wide phone first, scaling to tablet (768px) and desktop (1280px). Zero horizontal scrolling at 360px. Touch targets $\ge 44 \times 44\text{px}$. Evidence sheets render full-screen on mobile and as side panels on desktop.

---

## Round 3 Features & Capabilities (Phase 6)

### 1. Clarification & Grounded Recipient Q&A
- **Gap Detection & Clarification Questions**: Synthesizes targeted questions for detected gaps (`missing_rationale`, `unowned_task`, `conflicting_dates`).
- **Grounded Q&A Box**: Recipient asks natural-language questions about the project. Answers are derived strictly from permitted, verbatim source passages. If evidence is insufficient, it explicitly returns `insufficient evidence` and never hallucinates.
- **Interactive Citation**: Supported answers provide an interactive citation button opening the exact source passage in the evidence sheet.

### 2. Versioning & Permission-Driven Invalidation
- **Immutable Approved Versions**: Approved handovers create an immutable snapshot tied to the recipient.
- **Reviewer Edit Lifecycle**: Editing any item in an approved handover increments the version ($v1 \to v2$) and resets status to `under_review`, requiring human re-approval before the recipient can access it.
- **Permission-Driven Invalidation**: When a member is removed from a project or their clearance is demoted, live permission checks mark affected approved handovers as `stale` and immediately block access.

### 3. Authenticated Exports & Redacted Audit History
- **Authenticated Markdown & PDF Export**: Recipients can export approved handovers as Markdown (`.md`) or print-ready PDF HTML. Exports respect recipient clearance and redact unauthorized passages.
- **Redacted Audit Log**: Complete chronological audit trail recording approvals, views, edits, and receipts. Sensitive source passages are systematically redacted to prevent covert data leakage.
- **Negative-Access Test Suite**: Automated tests confirm restricted sources do not appear in views, answers, search results, or exports for lower-clearance users.

### 4. Accessibility & Responsive Polish
- Automated Axe (`@axe-core/playwright`) accessibility checks on all primary screens.
- Zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) across 360px, 768px, and 1280px.
- Full keyboard navigation with visible focus rings (`focus-visible:ring-2 focus-visible:ring-sky-500`).
- Tested with 200% browser zoom without clipping or loss of functionality.

---

## Monorepo Architecture

```
Prasaranam/
├── shared/           # Zod schemas, TypeScript types, and clearance hierarchy
├── server/           # Express backend, Gemini SDK, quotation validator, in-memory RLS store
├── client/           # React 18, Vite, Tailwind CSS, Lucide icons, TanStack Query
└── e2e/              # Playwright test suite (360px Mobile, 768px Tablet, 1280px Desktop)
```

---

## Quick Setup & Running Locally

### 1. Prerequisites
- Node.js $\ge$ 20.x
- npm $\ge$ 10.x

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration values:
```ini
PORT=4000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```
*Note: If `GEMINI_API_KEY` is omitted, Prasaranam automatically activates its deterministic fallback engine, which is visibly labeled non-AI across all screens.*

### 4. Build All Packages
```bash
npm run build
```

### 5. Start Development Servers
```bash
# Terminal 1: Starts Express server on http://localhost:4000
npm run dev:server

# Terminal 2: Starts Vite client on http://localhost:5173
npm run dev:client
```

---

## Testing & Verification Commands

### 1. Full Unit & Integration Test Suite (65 Tests)
Runs Vitest across backend and frontend workspaces:
```bash
npm test
```
- Server tests (61 passed): RLS access control, source deduplication, chunk offset preservation, quotation validation, deterministic fallback, gap detection, pre-prompt clearance filtering, grounded Q&A, versioning/invalidation, negative-access exports, and redacted audit history.
- Client tests (4 passed): Status badges, clearance badges, and verification badges.

### 2. Playwright End-to-End Test Suite (44 Tests)
Runs Playwright across Mobile (360px), Tablet (768px), and Desktop (1280px):
```bash
# Run Phase 6 Round 3 Suite (12 tests)
npx playwright test e2e/phase6-round3.spec.ts

# Run Regression Suite for Phases 1-5 (32 tests)
npx playwright test e2e/responsive-and-workflow.spec.ts

# Run all Playwright tests
npx playwright test
```

### 3. Linting
```bash
npm run lint
```

---

## Demo Walkthrough on a Phone-Sized Screen (360px Viewport)

Open Chrome or Edge DevTools, enable Device Mode, and select **360 × 740** (or custom 360px width):

### Step 1: Sign In as Elena Rostova (Project Owner)
1. Navigate to `http://localhost:5173/signin`.
2. Click the quick-fill button for **Elena Rostova (Lead / Restricted)** or enter:
   - Email: `elena.rostova@example.org`
   - Password: `Pass1234!`
3. Click **Sign In**.

### Step 2: Import Authorized Knowledge Source
1. Tap into **Project SolarPulse** (`proj-solarpulse-01`).
2. Tap **+ Import Source**.
3. Choose **Pasted Text** or **Markdown File**:
   - Title: `Battery Thermal Monitoring Runbook`
   - Clearance: `internal`
   - Content: `Inverter telemetry samples voltage every 10 seconds. Cutoff activates at 82% threshold.`
4. Tap **Import & Chunk Source**. The source is deduplicated by content hash and split into verifiable chunks with exact character offsets.

### Step 3: Run Knowledge Reconstruction Pipeline
1. On the project workspace, tap **Reconstruct Handover**.
2. Select pipeline mode and tap **Start Reconstruction Job**.
3. View job progress with status badges and safe error handling.

### Step 4: Generate Recipient-Specific Handover Draft
1. Tap the hamburger menu in the top-right corner and select **New Handover**.
2. Set Recipient to **Maya Patel (Incoming Engineer - Internal Clearance)**.
3. Title: `SolarPulse Operational Handover (Maya Patel)`.
4. Tap **Generate Verified Handover**. Notice that Rule 1 pre-filters sources before prompting so restricted sources never reach Maya's draft.

### Step 5: Review Workspace & Approval Guard
1. Review the generated handover on the mobile stacked card layout.
2. Tap **Inspect Evidence** on any statement to open the full-screen mobile Evidence Sheet. Observe verbatim quote highlighting. Close with the `X` button or `Escape`.
3. Tap **Edit** on a statement: change statement text and add a rationale note. Notice the original source passage remains untouched, and reviewer context is recorded.
4. The draft cannot be approved until every factual statement is approved or marked unknown. Tap **Approve** on each item.
5. Tap **Approve Entire Draft**. Once approved, tap **Share with Maya Patel**.

### Step 6: Recipient View, Grounded Q&A, and Formal Receipt
1. Open the mobile menu and tap **Sign Out**.
2. Sign in as **Maya Patel**:
   - Email: `maya.patel@example.org`
   - Password: `Pass1234!`
3. Open Maya's shared handover.
4. **Try Grounded Q&A**:
   - Unsupported query: Type `What is the secret recipe for quantum microwave popcorn?` and tap **Ask Verified Evidence**. Notice it returns `INSUFFICIENT EVIDENCE (UNSUPPORTED)` and refuses to guess.
   - Supported query: Type `How often does the ingestion pipeline process MQTT sensor payloads?` and tap **Ask Verified Evidence**. Notice it returns `VERIFIED EVIDENCE (SUPPORTED)` with `every 60 seconds` and a citation button that opens the evidence drawer.
5. **Export**: Tap **Export Markdown** to download the authenticated Markdown file.
6. **Audit History**: Tap **Audit History** to open the redacted audit log modal showing who approved and viewed the document without leaking sensitive passages.
7. **Acknowledge Receipt**: Enter confirmation notes and tap **Confirm Handover Receipt** to permanently record the formal handover sign-off.

---

## Known Limitations

1. **AI Rate Limits & Fallback**: When running without a live `GEMINI_API_KEY` (or during quota throttling), the system automatically uses its deterministic fallback engine. All outputs are clearly labeled `NON-AI DETERMINISTIC FALLBACK (NOT A LIVE AI RESULT)`.
2. **In-Memory Store Persistence**: The demo application uses an in-memory database store with complete RLS and relational integrity. Restarting the server resets the store to initial seed state.
3. **Browser Print to PDF**: The PDF export opens a print-formatted HTML view configured with `@media print` CSS rules, allowing the user to save as PDF via the browser's native print dialog.
