# POE Phase 2 — QA Fix Handoff & Status

**Last updated:** 2026-11-20
**Purpose:** Full status of Round-3 client QA + Admin items, plus every file changed, so work can resume in a fresh session with nothing lost.

---

## ⚠️ Critical workflow rules (do NOT break)
- **I (Claude) do NOT push to git.** The user commits / pushes / deploys to AWS staging themselves.
- **Do NOT run `git reset --hard` or `git checkout` on the Mac.** Server-side DB resets are fine.
- The user **swaps `svelte.config.js` manually** between adapters. It is currently on **adapter-node (AWS)** — verified, correct for staging. No migration needed for the current batch (migration 004 `proxy_preview_interest` already handled).
- Deploy to **staging only** — no production until client approval.
- Always **compile-check** changed `.svelte` files before telling the user to push (lesson from the `<svelte:window>` build break).

### Environments
- Local DB: `poe_dev` @ port 5433. Prod: AWS RDS.
- Local test login: `sri@softscripts.net` / `123456` (restored on local; staging/prod untouched).
- Admin auth = `localStorage 'admin'` only (no server cookie). Admin is also a normal user (has 'user' cookie), so my-proposals / create work on the admin page.
- Artifact (design source of truth) via `/api/published_artifacts/<id>`.

---

## STATUS SUMMARY

### Serious — ALL DONE ✅
| # | Item | Status |
|---|------|--------|
| 1 | Approved proposals don't show when attaching no-action/exempt ("No approved proposals found") | ✅ Done — root cause was auth (sameSite) |
| 2 | Filer's "Your proposal" owner panel missing from detail popup (Attach buttons, Estimated/Known switch, proxy status) | ✅ Done — owner panel ported into `ProposalDetail.svelte` |
| 3 | Reloading / opening share link signs you out | ✅ Done — cookie `sameSite: 'strict'` → `'lax'` |

**Root cause for #1–#3 was shared:** `sameSite: 'strict'` dropped the auth cookie on share-link / cross-site entry. Changed to `'lax'` in login + logout. Verified locally: reload stays logged in; my-proposals returns approved proposals; owner panel + attach buttons appear for the owner.

### Medium — ALL DONE ✅
| # | Item | Status |
|---|------|--------|
| 4 | Searching from a later page shows empty table (pager stuck "Page 16/1") | ✅ Done — `$effect` resets `currentPage = 1` on search |
| 5 | Suggested meeting date wrong (year off + day off-by-one) | ✅ Done — string-based `suggestAgm` (year+1), `to_char` in SQL |
| 6 | CIK sticks after company name changed | ✅ Done — CIK clears on company input |
| 7 | Company lookup skips legacy filings (Avnet/Fox) | ✅ Done — UNION proposals + legacy in companies endpoint |
| 8 | Share-link page step order differs from popup | ✅ Done — **kept Round-2 order** per client decision (Proposal → No-Action → Exclusion → Exempt → AGM in both views) |

### Minor — ALL DONE ✅ (except #14 awaiting client answer)
| # | Item | Status |
|---|------|--------|
| 9 | Leading/trailing spaces break search | ✅ Done — `normalize()` alphanumeric-only search |
| 10 | No-results wording ("No proposals yet / 0–0 of 0") | ✅ Done — proper "nothing matched" messaging |
| 11 | No-Action tab: basis as bullet "• Unknown"; raw upload filenames | ✅ Done — `.basis-inline` comma-joined; `cleanFileName()` strips `^\d{10,}-` prefix |
| 12 | Popup timeline Exclusion status lowercase ("included") | ✅ Done — capitalized |
| 13 | Escape doesn't close popups | ✅ Done — `<svelte:window>` Escape handlers added |
| 14 | "Account settings" not a link + larger font | ⚠️ **Partially done / awaiting client** — made it a link to `/dashboard` + fixed to 12px. **Client question still open:** what page/action should "Account Settings" open? (we used `/dashboard` as placeholder) |
| 15 | Footer "Submit Exempt Solicitation" → /login even when signed in | ✅ Done — opens submit modal when signed in (`.footer-link-btn`) |
| 16 | Sorting Exclusion column puts legacy rows first | ✅ Done — `legacyLastCols` pushes legacy last for exclusion/no_action |

### Admin — 1–3 DONE ✅, 4 OPEN
| # | Item | Status |
|---|------|--------|
| A1 | Admin submission pill still goes to old Exempt Solicitation submit | ✅ Done — **pill hidden** (commented out) per user: hold for client approval |
| A2 | Replace "Abstain" with "Independent" in voting input | ✅ Done — label → "Independent" (kept internal `vote_abstain` field) |
| A3 | Admin ability to edit submission fields (v1.0 parity) | ✅ Done — see below |
| A4 | "Where does the Admin note go?" + set up SMTP | ⏳ **OPEN** — see below |

---

## A3 — Admin inline edit (DONE, details)
Built fresh (editMode/saveEdit were dead code from v1.0, never ported to phase-2). Matches the public filing form.
- **EDIT** button → submission fields become inputs; footer shows **Cancel · Save changes · Approve · Reject**.
- **Editable (client-entered fields only):**
  - Company Name → **typeahead** (pick → CIK auto-fills), matching filing form
  - Registrant CIK
  - Proposal Topic → **dropdown** from shared `TOPICS` (preserves a custom topic as first option if not in list)
  - Annual Meeting → date input + Estimated/Known toggle
  - Resolution / proposal text
  - Legacy exempt fields (memo_submitter, def14a_link, item_number, contact_name, subject)
- **Read-only (NOT editable):** filer identity / "Submitted By" / logged-in-user details, **and the uploaded PDF** (client decision: "Text fields only, leave PDF").
- All existing admin functions (approve/reject/votes/attach/notes) remain intact.
- **Event syntax note:** `admin/dashboard/+page.svelte` uses OLD Svelte syntax (`on:click`/`on:input`). Must use `on:` — mixing with new `onclick` causes a compile error.

---

## A4 — OPEN (needs attention in next session)
Two parts:
1. **"Where does the Admin note go?"** — ✅ **TRACED (2026-11-20):**
   - The **ADD button is dead** — `+page.svelte:797` `<button class="add-btn">ADD</button>` has **no `on:click`**. Clicking it does nothing.
   - The note IS saved to `filings.admin_note`, but **only as a side-effect of Approve/Reject** — `adminNote` is sent as `note` only inside `updateStatus()` (`:280`), written by `api/admin/update-status/+server.js:32`. A note typed without then approving/rejecting is discarded (`closeModal` resets `adminNote=""` at `:249`).
   - `admin_note` is **never read back / displayed anywhere** (written in update-status + the 2 attach endpoints' hardcoded `"Attached by administrator"`; grep shows 0 read sites). Reopening a reviewed filing shows an empty box, not the saved note. Write-only column.
   - **Awaiting client decision** on desired behavior (running note log w/ timestamp+admin / single persistent note / just make ADD save current column / remove ADD button). Asked user 2026-11-20 — dismissed, no decision yet. No code changed.
2. **SMTP setup** — Client wants password-reset + sign-in-confirmation emails. This is a **deploy step on the live server** needing credentials the client must provide:
   - **Email Address**
   - **App Password** (email app password)
   - These configure the app's email service. **Blocked until client provides them.**

---

## FILES CHANGED (this QA cycle)

### Auth (#1–#3)
- `src/routes/api/auth/login/+server.js` — cookie `sameSite: 'strict'` → `'lax'`
- `src/routes/api/auth/logout/+server.js` — same

### Submit modal
- `src/lib/SubmitFilingModal.svelte` — edit mode (#7/#8 of Round-2); multi-select exclusion dropdown (`.ms-trigger/.ms-panel/.ms-backdrop`); mm/dd/yyyy date fields (`dateField` snippet, `formatMdy`/`isoToMdy`/`mdyToIso`/`openDatePicker`, native picker anchored inside modal); `suggestAgm` rewritten string-based (year+1, `/^(\d{4})-(\d{2})-(\d{2})/`); company typeahead space-insensitive (`normName`); CIK clears on company input; footer shows only when mode selected; Escape via `<svelte:window>` (top-level!); account-settings note `.account-note` (12px + link to `/dashboard`); unified confirm popup body; `.submit-modal{max-width:820px}`

### Public detail / listing
- `src/lib/ProposalDetail.svelte` — owner "Your proposal" panel (`.owner-actions`, white bg + 4px gold left border, `.btn-view`/`.btn-attached`, stacked `.owner-status-row`); two-column `.pd-header-row`; Share row in left column; title spacing (`.pd-company` 26px); removed inner scrollbar; Escape handler; `cleanFileName` on filenames; `.basis-inline` comma-joined; EXCLUSION status capitalized; `user` prop + `isOwner` + embedded `SubmitFilingModal`
- `src/routes/+page.svelte` — `let { data } = $props()` to pass user; `normalize()` search (alphanumeric-only); `$effect` resets `currentPage = 1` on search; no-results wording; sort pushes legacy last (`legacyLastCols = new Set(["exclusion","no_action"])`)
- `src/lib/formatDate.js` — added `cleanFileName(name)` = `replace(/^\d{10,}-/, '')`
- `src/routes/filing/[id]/+page.svelte` — owner panel artifact styling; cleanFileName; basis-inline; timeline order (Round-2: Proposal → No-Action → Exclusion → Exempt → AGM)
- `src/routes/+layout.svelte` + `src/app.css` — footer "Submit Exempt Solicitation" opens submit when signed in (`.footer-link-btn`)

### APIs (timezone / lookup)
- `src/routes/api/filings/companies/+server.js` — `to_char(meeting_date,'YYYY-MM-DD')`; UNION proposals (company_name w/ CIK) + legacy (memo_submitter, NULL cik); DISTINCT ON prefers rows with CIK
- `src/routes/api/filings/my-proposals/+server.js` — `to_char(meeting_date,'YYYY-MM-DD')`
- `src/routes/api/filings/update-proposal/+server.js` — `$2::text`/`$4::text` casts (fixed "inconsistent types deduced for parameter" error)

### Shared
- `src/lib/topics.js` — **NEW** shared `TOPICS` array (11 topics), used by filing form + admin edit

### Admin (A1–A3)
- `src/routes/admin/dashboard/+page.svelte` — removed `.s-8yXO12Wbi8z8` mono catch-all (fonts now sans like home); `.label` mono; `td` 14px; detail modal typography matched to public popup (serif titles `!important`, 12px h4 w/ border); status badge uses color-coded `.status {status}` (not `.status-tag`); Vote Results `.vote-title` Georgia serif `!important`; Save button right-aligned (`order:3;margin-left:auto`); `.vote-foot-divider{display:none}`; ABSTAIN label → "Independent" (internal field kept); **hid "+ Submit Exempt Solicitation" pill + AdminSubmitModal** (A1); imported `fmtDate, cleanFileName`, `TOPICS`; `startEdit`/`cancelEdit`/`originalFiling`; editMode reset in openReview/closeModal; footer EDIT/SAVE CHANGES/CANCEL; editable legacy + proposal fields (`.edit-input`/`.edit-textarea`/`.edit-meeting`); company typeahead (`editCompanies`, `editCompanyDd`, `editCompanyResults` $derived, `pickEditCompany`, `loadEditCompanies`, `normName`, `.company-ta`/`.company-ta-dd`/`.ta-item`); proposal topic `<select>` with TOPICS. **Uses `on:` old event syntax.**
- `src/routes/api/admin/update-filing/+server.js` — UPDATE extended to proposal_topic, proposal_text, meeting_date (null-safe), meeting_date_known, proxy_status (was legacy-only)
- `src/routes/api/admin/filings/+server.js` — `to_char(meeting_date,'YYYY-MM-DD') AS meeting_date` (TZ-safe editing)

---

## KEY TECHNICAL GOTCHAS (don't rediscover these)
- **`<svelte:window>` must be at component TOP LEVEL** — nesting it in an element/block fails the build (`svelte_meta_invalid_placement`). This broke a staging deploy once.
- **pg `date` columns serialize to UTC ISO** → off-by-one day in +offset TZ (IST). Fix: `to_char(col,'YYYY-MM-DD')` in SQL + string date math (never `toISOString()` for date-only).
- **Admin dashboard uses OLD event syntax** (`on:click`/`on:input`) — cannot mix with new `onclick`/`oninput` in the same component.
- **Svelte scoped CSS `:where()` = 0 specificity.** A stray `.s-… {font-family:mono !important}` was forcing mono everywhere — removed.
- **`showPicker()` needs a user gesture**; anchor controlled by hidden date input's placement.
- Legacy company data: `company_cik` is the FILER's CIK (e.g. `0001734335` = John Chevedden for both Fox & Avnet); target company is in `memo_submitter` → legacy rows get NULL cik with "add CIK" hint in lookup.

---

## WHAT'S READY TO DEPLOY
The full batch (A1–A3 + all Medium/Minor + consistency fixes) is **ready to commit → push → redeploy to staging**. **No DB migration needed.** `svelte.config.js` already on adapter-node.

## REMAINING WORK (next session)
1. **#14** — confirm with client what "Account Settings" should open (placeholder = `/dashboard`).
2. **A4 part 1** — trace the Admin note ADD button (saved? shown? wired up?).
3. **A4 part 2** — SMTP setup on live server; **blocked** until client sends Email Address + App Password.
