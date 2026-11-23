# POE Phase 2 — Project Handoff & State

_Last updated: 2026-11-12. This file captures the full state so a fresh session can continue with nothing lost. Read it top to bottom before resuming._

---

## 1. What this is

**POE = Proxy Open Exchange** (proxyopenexchange.org), operated by **As You Sow** — a platform for shareholder proxy filings under SEC Rule 14a-8. **Phase 2** makes it **proposal-centric**: shareholder **Proposals** are the primary record; **No-Action/Exclusion** and **Exempt Solicitation** documents attach to a proposal. Phase-1 standalone exempt solicitations remain as legacy records.

- **Stack:** SvelteKit 2.x + Svelte 5 runes, PostgreSQL (`pg`), files saved to `static/uploads/` (the `*_s3_key` columns hold **local** paths, not real S3).
- **Local project:** `/Users/prathushanammi/Desktop/Poe-Project-new/frontend`
- **Scope doc (source of truth):** `~/Downloads/POE_Phase2_Scope_v4.docx` (and identical `.pdf`). Client prototype artifact referenced in it.

## 2. Dev & database setup

- **Production** = AWS RDS PostgreSQL 17, DB `proxyopenexchange` (host `proxy-open-exchange-db...us-east-1.rds.amazonaws.com`). **Do NOT develop against it.** Tables: filings, users, admin_users, cik_registry.
- **Staging** = local clone **`poe_dev`** on Homebrew Postgres 14 at **`localhost:5433`**, user `prathushanammi`, no password (trust auth). Row-for-row copy of prod.
- **Switch:** `frontend/.env` `DATABASE_URL` — local line points at `poe_dev`; the prod RDS line is kept commented. `src/lib/server/db.js` sets SSL off for localhost, on for RDS.
- **psql / pg_dump:** `/Library/PostgreSQL/18/bin/` (pg18 client talks to the pg14 clone fine).
- **Run the dev server:** `cd frontend && npm run dev` → http://localhost:5173 . Kill a stuck port: `lsof -ti:5173 | xargs kill -9`.
- **Compile-check a Svelte file without running:** `node -e "const fs=require('fs');const{compile}=require('svelte/compiler');compile(fs.readFileSync('<file>','utf8'),{generate:'client'})"`.
- **Admin dashboard** auth is `localStorage.admin`; test users sign in via `/api/auth/login`. Test account used this session: **prathusha@softscripts.net / 123456** (user id 28). Original password hash was restored earlier; 123456 may be current — reset if needed.

## 3. Migrations (run all three on prod at deploy)

- `migrations/001_phase2.sql` — 18 additive nullable columns + self-FK `proposal_id` + indexes.
- `migrations/002_password_reset.sql` — `users.reset_token`, `reset_token_expires`.
- `migrations/003_multiple_exclusion_bases.sql` — widens `exclusion_basis` VARCHAR(100)→TEXT.
All applied to the clone; all additive/non-breaking.

## 4. Status — everything built; what's left

**All client-requested features in the scope doc + appendix are built and tested.** Remaining:

### Pending (2)
1. **Password-reset email delivery** — flow/pages/token all built; needs an **SMTP credential** (Gmail App Password for the softscripts.net Workspace account, or a mail service) in `.env` on the live server. Wired via `SMTP_HOST/PORT/USER/PASS/FROM` in `src/routes/api/auth/forgot/+server.js` (`sendResetEmail`). Until set, the reset link shows on-screen in dev only. **Deploy step, not code.**
2. **User self-editing of proposal text + replacing PDFs** (appendix Q4) — proxy-status + AGM toggle are done (from the detail page); text edit (marked admin-only in Q4d) and PDF replacement are **not built**. Blocked on the client's Q4/Q5 answer.

### Open questions for the client (gathered)
1. **Proxy Preview 2027 link URL** (Q6) — still blank; confirmation popup shows "(link coming soon)" until supplied. _Only launch blocker._
2. **Remove "Pending" from the public Proposal Tracker card?** — scope §4/Q8 say remove it (keep on admin); it is currently still shown. _Recommend remove._
3. **Keep the Standalone Exempt 4th dropdown mode?** (Q5d) — appendix removed the "Other" 4th type; we built a Standalone mode for legacy filings. _Recommend keep._
4. **Which fields can a filer self-edit after submission?** (Q4) — confirm text (admin-only?) + PDF replacement.
5. **Minor:** "Added by admin" visible tag on admin-attached docs? · admin table shows org name (not entered name) for standalone filings · password min length set to **6** (ok?).

### Conscious deviations
- Standalone Exempt = a 4th submission mode (for legacy exempt with no parent).
- Public Tracker still shows "Pending" (pending client decision #2 above).

## 5. Changes made THIS session (most recent work)

- **Admin tooling:** remove attached document (`api/admin/remove-attachment`), attach to any proposal (`api/admin/attach`), Vote Results input (`api/admin/vote-results`, admin-only/hidden from public), attachment filter, search + pagination, close-button restyle.
- **Fixed (HIGH):** attachments now **publish immediately** — `api/filings/create` no_action/exempt branches set status `approved` + the parent `has_*` flag (was pending). Matches scope §2/§5.
- **Proxy Preview confirmation popup** on new-proposal submit (SubmitFilingModal); **forgot/reset password** flow (min 6 chars).
- **Multiple exclusion bases** (appendix Q7) — checkbox multi-select; stored as JSON array; shared helper `src/lib/exclusionBases.js` (`EXCLUSION_BASES`, `parseBases`); displayed as bulleted list in admin modal, home popup, and `filing/[id]`.
- **Company-named inline attach confirmation** banner.
- **Dates standardized to US MM/DD/YYYY** everywhere via `src/lib/formatDate.js` (`fmtDate`) + the two local `fmt` helpers (ProposalDetail, filing/[id]) all forced to `en-US` 2-digit. No raw `toLocaleDateString()` remains.
- **EDGAR CIK lookup** (optional §8) — `api/filings/edgar-lookup` fetches + caches SEC `company_tickers.json` (24h), server-side search; SubmitFilingModal company typeahead shows "FROM SEC EDGAR — NOT YET ON POE" results that fill name + 10-digit CIK.
- **Home index table typography** fixed (headers no longer wrap mid-word; Date/Filer spacing).
- **Fonts actually loaded** — `src/app.html` now links Google Fonts **DM Serif Display + IBM Plex Mono (+ IBM Plex Sans)**; they were referenced in CSS (`--serif`, `--mono`) but never loaded, so the whole site had been falling back to Georgia/Courier New. Loading them matches the artifact.
- **Home sidebar "Resolution Tracker" → "Proposal Tracker"** and the 6 boxes reordered per client: TL Companies · TR Filers · ML Proposals · MR No-Action · BL Exempt Solicitation · BR Pending. (`routes/+page.svelte`)
- **Removed** the "→ Submit Proposal (Beta)" link from the Resources sidebar.
- **Header submit bar** (`routes/+layout.svelte`): replaced the two buttons ("Submit Exempt Solicitation →", "Submit A Proposal (Beta) →") with a single **"Submit a Filing →"** button (opens the modal if signed in, else /login) + text "Submit a new shareholder proposal or attach documents to an existing one."
- **Home/admin detail popup width 780 → 860px** (match artifact); admin VIEW modal Written-Materials white card + serif heading; Proposal tab shows the real PDF filename.

## 6. Key files map

- `src/routes/+page.svelte` — home: proposal-centric index (7 sortable headers, default Company A–Z, pagination, search), Proposal Tracker sidebar, ProposalDetail popup on row click.
- `src/lib/ProposalDetail.svelte` — home detail popup (unified Written Materials, lifecycle, social share).
- `src/routes/filing/[id]/+page.svelte` (+ `+page.js`) — public detail page with owner panel (attach, proxy-status selector, AGM toggle).
- `src/lib/SubmitFilingModal.svelte` — the 4-mode submit popup (new / no_action / exempt / standalone); company typeahead + EDGAR; inherited fields; multi exclusion-basis checkboxes; Proxy Preview confirmation popup.
- `src/routes/admin/dashboard/+page.svelte` — admin queue (approve/reject/delete/view), attach/remove, Vote Results, filter, search, pagination.
- `src/routes/+layout.svelte` — header nav + submit bar + mounts SubmitFilingModal.
- `src/app.html` — font links. `src/app.css` — global styles (`--serif`, `--mono`, `--sans`, colors, `.stat-*`, `.submit-bar*`).
- `src/lib/server/db.js` — pg pool + SSL switch. `src/lib/formatDate.js`, `src/lib/exclusionBases.js` — shared helpers.
- API: `src/routes/api/filings/{create,public,stats,companies,my-proposals,edgar-lookup}/+server.js`; `src/routes/api/admin/{filings,update-status,update-filing,remove-attachment,attach,vote-results,delete}/+server.js`; `src/routes/api/auth/{login,signup,logout,forgot,reset}/+server.js`.

### Known data note
- `api/filings/stats/+server.js` has a latent naming quirk (`companies = DISTINCT memo_submitter`, `filers = DISTINCT company_name`); the home tracker works around it with client-side `tracker.*` derived values, so the displayed counts are correct. Clean up if touching stats.

## 7. Test data in the clone (not real)

Created via the real submission flow during testing (safe to delete): Meridian Power Inc (270, approved, + live no-action 272 & exempt 273), Aurora Biotech (275, approved), Granite Rail (276, rejected), plus a few t8-named records and "Test"/"test topic" pending rows. Real Phase-1 legacy exempt solicitations (~229) are untouched. Say "clean up test records" to remove the test ones.

## 8. Pre-launch checklist

- [ ] Deploy Phase 2 code to the live server
- [ ] Run migrations 001 + 002 + 003 on the production RDS database
- [ ] Add `SMTP_*` env vars (App Password) on the live server for reset email
- [ ] Set the Proxy Preview 2027 URL (const `PROXY_PREVIEW_URL` in SubmitFilingModal, or env)
- [ ] Confirm client decisions: public tracker "Pending" (remove?), user-editable fields (Q4), password min length (6?)

## 9. Deliverables produced this session

- **Color-coded status page** (green=done / red=open, in scope-doc order): artifact `https://claude.ai/code/artifact/87e64eb5-9061-4657-bb69-32927aede954`.
- **Earlier checklist doc** (Claude Doc): `https://claude.ai/artifact/HapjZ2Ajbp7gdXw877crkj`.
- **Annotated scope .docx** (green/red highlights + doubts section): `~/Downloads/POE_Phase2_Scope_v4 - Build Status.docx`.
- Memory build log: `poe-build-log.md` (in Claude memory) mirrors much of this.

## 10. How to resume in a fresh session

1. Open the project: `/Users/prathushanammi/Desktop/Poe-Project-new/frontend`.
2. Read this file first. Confirm `.env` DATABASE_URL points at the local `poe_dev` clone.
3. `npm run dev`; verify http://localhost:5173 loads.
4. Pick up from Pending (§4) or the next client change. For client UI tweaks, edit the files in §6 and verify in the browser.

---

## 2026-11-24 — Client bug fixes (attach dropdown, owner panel, PDFs)

### Bug 1 & 2: proposals not showing on attach + owner "Your proposal" panel missing
**Root cause:** seeded/legacy proposals have `filer_user_id = NULL` (or not matching the
signed-in user). Both the attach dropdown (`/api/filings/my-proposals`) and the detail-page
owner panel (`isOwner`) matched strictly on `filer_user_id`, so the owning org saw neither.
**Fix (code, verified on clone):**
- `src/routes/api/filings/my-proposals/+server.js` — match `filer_user_id = $1` OR
  (`filer_user_id IS NULL` AND `LOWER(TRIM(filer_name)) = LOWER(TRIM(org_name))`).
- `src/routes/filing/[id]/+page.svelte` — `isOwner` gains the same org-name fallback.
- `migrations/005_backfill_filer_user_id.sql` — permanently links unlinked proposals by
  matching filer_name → users.org_name (only when exactly one user matches). Run on staging+prod.
Verified: with proposal 281 set to filer_user_id=NULL, it vanished from the dropdown and the
owner panel disappeared; after the fallback it reappears in both. Test data restored.

### Bug 3: "Still getting an error on the pdfs"
**Diagnosed on staging (http://staging.3.209.207.63.nip.io):** 155 of 160 PDF references
return 404; only the 5 most-recent uploads serve. The files are physically gone.
**Root cause:** `static/uploads/` lives inside the git tree, and the deploy
(`git reset --hard origin/phase2`) wipes PDFs uploaded through the live site. Only files
uploaded since the last deploy survive.
**Fix (code, verified on clone):** decouple uploads from the repo.
- `src/routes/api/filings/create/+server.js` — `UPLOAD_DIR = process.env.UPLOAD_DIR || 'static/uploads'`;
  stored key is now always the stable URL path `uploads/<filename>`.
- `src/routes/uploads/[...file]/+server.js` — serves from `process.env.UPLOAD_DIR` first,
  falls back to in-repo `static/uploads` (seed files), basename-only + traversal guard.
**DEPLOY STEPS REQUIRED (without these the fix does nothing):**
1. Deploy phase2 with the code above.
2. On the staging/prod server set `UPLOAD_DIR` to a PERSISTENT path OUTSIDE the repo,
   e.g. `/home/ubuntu/poe-uploads`, in the server `.env`. Create the dir, `mkdir -p`.
3. This dir must NOT be inside `~/POE-staging` (so `reset --hard` never touches it).
4. Run `migrations/005_backfill_filer_user_id.sql` on staging + prod DBs.
**Unrecoverable:** the 155 already-deleted files are gone (0 exist in local static/uploads).
They must be re-uploaded or restored from a backup of staging's old uploads dir / the client's
originals. Code cannot resurrect deleted bytes.
