<script>
  import { parseBases } from "$lib/exclusionBases.js";
  import { cleanFileName } from "$lib/formatDate.js";
  import SubmitFilingModal from "$lib/SubmitFilingModal.svelte";

  let { open = $bindable(false), record = null, exempt = null, noAction = null, user = null } = $props();

  let materialTab = $state("proposal");

  const fmt = (d) => {
    if (!d) return "-";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d)); // date-only / ISO → no timezone shift
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  };
  const isLegacy = (r) => r && r.filing_type === "exempt_solicitation" && !r.proposal_id;

  // ── owner controls ("Your proposal" panel, like /filing/[id]) ──
  const isOwner = $derived(!!(user && record && user.id === record.filer_user_id));
  let attachOpen = $state(false);
  let attachMode = $state("");
  let proxyStatus = $state("");
  let agmKnown = $state("estimated");
  // keep the owner-field selects in sync with the record each time it opens
  $effect(() => {
    if (open && record) {
      proxyStatus = record.proxy_status || "";
      agmKnown = record.meeting_date_known ? "known" : "estimated";
    }
  });
  function openAttach(mode) { attachMode = mode; attachOpen = true; }
  async function saveProxy() {
    try {
      await fetch("/api/filings/update-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          proxy_status: proxyStatus || null,
          meeting_date_known: agmKnown === "known",
        }),
      });
    } catch (e) { /* non-blocking */ }
  }

  function close() { open = false; }
  $effect(() => { if (open) materialTab = "proposal"; });

  // ── focus management (accessibility) ──
  // When the dialog opens, remember what was focused, then move focus into the
  // dialog; restore focus to the opener when it closes. Tab is trapped inside.
  let modalEl = $state(null);
  let lastFocused = null;
  $effect(() => {
    if (open) {
      lastFocused = typeof document !== "undefined" ? document.activeElement : null;
      queueMicrotask(() => modalEl?.focus());
    } else if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
      lastFocused = null;
    }
  });
  function trapFocus(e) {
    if (e.key !== "Tab" || attachOpen || !modalEl) return; // nested modal manages its own focus
    const f = modalEl.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── social share ──
  let copied = $state(false);
  // Share the current environment's URL so the copied/shared link points at the
  // page the user is actually on (prod → prod, staging → staging). Falls back to
  // the canonical prod origin during SSR.
  const CANONICAL = "https://proxyopenexchange.org";
  const shareOrigin = typeof window !== "undefined" ? window.location.origin : CANONICAL;
  const shareUrl = $derived(record ? `${shareOrigin}/filing/${record.id}` : "");
  const shareTitle = $derived(record ? `${record.company_name || record.subject || "Shareholder Proposal"} — Proxy Open Exchange` : "");
  const liUrl = $derived(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`);
  const xUrl = $derived(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`);
  const fbUrl = $derived(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
  const mailUrl = $derived(`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`);
  // Email share menu — opens a prefilled compose window in the viewer's own webmail
  // (Gmail/Outlook, new tab) or their default mail app, so it works without needing a
  // mailto handler configured in the browser.
  let mailMenuOpen = $state(false);
  const gmailUrl = $derived(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`);
  const outlookUrl = $derived(`https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`);
  function onDocClick(e) { if (mailMenuOpen && !e.target.closest(".mail-wrap")) mailMenuOpen = false; }
  // Open webmail compose in a normal-sized popup window (not a full browser tab).
  function openCompose(url) {
    const w = 680, h = 720;
    const left = Math.max(0, Math.round((window.screen.width - w) / 2));
    const top = Math.max(0, Math.round((window.screen.height - h) / 2));
    window.open(url, "poe-compose", `width=${w},height=${h},left=${left},top=${top}`);
    mailMenuOpen = false;
  }
  async function copyLink() {
    const confirm = () => { copied = true; setTimeout(() => (copied = false), 1800); };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-secure (HTTP) contexts — navigator.clipboard is
        // unavailable there (e.g. the http staging site), so use execCommand.
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      confirm();
    } catch (e) {
      confirm();
    }
  }
</script>

<svelte:window onclick={onDocClick} onkeydown={(e) => { if (open && e.key === "Escape") { if (mailMenuOpen) { mailMenuOpen = false; } else if (!attachOpen) { close(); } } }} />

{#if open && record}
  <div class="pd-overlay" onclick={close} role="presentation">
    <div class="pd-modal" bind:this={modalEl} tabindex="-1" onclick={(e) => { e.stopPropagation(); onDocClick(e); }} onkeydown={trapFocus} role="dialog" aria-modal="true" aria-labelledby="pd-title">
      <div class="pd-head">
        <h3 id="pd-title">
          {#if isLegacy(record)}Exempt Solicitation — {record.subject || "-"}
          {:else}{record.company_name || "-"} — Shareholder Proposal{/if}
        </h3>
        <button class="pd-x" onclick={close} aria-label="Close">×</button>
      </div>

      <div class="pd-body">
        {#if isLegacy(record)}
          <!-- LEGACY STANDALONE -->
          <p class="pd-date">Filed {fmt(record.created_at)}</p>
          {@render shareRow()}
          <div class="pd-section">
            <h4>PROXY INFORMATION</h4>
            <div class="pd-grid">
              <div>Company</div><div>{record.memo_submitter || "-"}</div>
              <div>DEF 14A Filing</div><div>{#if record.def14a_link}<a href={record.def14a_link} target="_blank" rel="noreferrer">{record.def14a_link}</a>{:else}-{/if}</div>
              <div>Proposal Item</div><div>{record.item_number || "-"}</div>
              <div>Topic</div><div>{record.subject || "-"}</div>
              <div>Contact</div><div>{record.contact_name || "-"} · {record.contact_email || "-"}</div>
            </div>
          </div>
          <div class="pd-section">
            <h4>WRITTEN MATERIALS</h4>
            {#if record.pdf_s3_key}<a class="pd-pdf" href={`/${record.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(record.pdf_filename)}</a>{:else}<p class="pd-muted">No PDF uploaded</p>{/if}
          </div>
          <p class="pd-note">This exempt solicitation was filed under POE Phase 1 as a standalone record. It is not linked to a parent proposal and has no no-action or proxy-status data.</p>

        {:else}
          <!-- UNIFIED PROPOSAL -->
          <div class="pd-header-row">
            <div class="pd-header-left">
              <h2 class="pd-company">{record.company_name || "-"}<span class="pd-badge {record.proxy_status || 'pending'}">{record.proxy_status ? record.proxy_status.charAt(0).toUpperCase() + record.proxy_status.slice(1) : "Pending"}</span></h2>
              <p class="pd-date">
                Filed: {fmt(record.created_at)} · Filer: {record.filer_name || "-"}
              </p>
              {@render shareRow()}
            </div>

            {#if isOwner}
              <div class="owner-actions">
                <div class="owner-actions-label">Your proposal</div>
                <div class="owner-btn-row">
                  {#if noAction}
                    <button type="button" class="btn-sm btn-attached" disabled>✓ No-Action attached</button>
                  {:else}
                    <button type="button" class="btn-sm btn-view" onclick={() => openAttach("no_action")}>+ Attach No-Action</button>
                  {/if}
                  {#if exempt}
                    <button type="button" class="btn-sm btn-attached" disabled>✓ Exempt Solicitation attached</button>
                  {:else}
                    <button type="button" class="btn-sm btn-view" onclick={() => openAttach("exempt")}>+ Attach Exempt Solicitation</button>
                  {/if}
                </div>
                <div class="owner-status-inline">
                  <label class="owner-status-row">AGM date
                    <select bind:value={agmKnown} onchange={saveProxy}>
                      <option value="estimated">Estimated</option>
                      <option value="known">Known</option>
                    </select>
                  </label>
                  <label class="owner-status-row">Proxy status
                    <select bind:value={proxyStatus} onchange={saveProxy}>
                      <option value="">Not yet known</option>
                      <option value="included">Included</option>
                      <option value="excluded">Excluded</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </label>
                </div>
              </div>
            {/if}
          </div>

          <div class="pd-life">
            <div class="pd-step done"><span class="pd-dot"></span><span class="pd-l">PROPOSAL FILED</span><span class="pd-s">{fmt(record.created_at)}</span></div>
            <div class="pd-step {noAction ? 'done' : ''}"><span class="pd-dot"></span><span class="pd-l">NO-ACTION</span><span class="pd-s">{noAction ? (noAction.notice_date ? fmt(noAction.notice_date) : "Filed") : "None on record"}</span></div>
            <div class="pd-step {record.proxy_status ? 'done' : ''}"><span class="pd-dot"></span><span class="pd-l">EXCLUSION</span><span class="pd-s">{record.proxy_status ? record.proxy_status.charAt(0).toUpperCase() + record.proxy_status.slice(1) : "Not yet known"}</span></div>
            <div class="pd-step {exempt ? 'done' : ''}"><span class="pd-dot"></span><span class="pd-l">EXEMPT SOLICITATION</span><span class="pd-s">{exempt ? "Filed" : "None on record"}</span></div>
            <div class="pd-step {record.meeting_date_known ? 'done' : ''}"><span class="pd-dot"></span><span class="pd-l">{record.meeting_date_known ? "AGM DATE" : "EST. AGM DATE"}</span><span class="pd-s">{fmt(record.meeting_date)}</span></div>
          </div>

          <div class="pd-two">
            <div>
              <h4>COMPANY</h4>
              <div class="pd-grid">
                <div>Company</div><div>{record.company_name || "-"}</div>
                <div>Registrant CIK</div><div>{record.company_cik || "-"}</div>
                <div>Proposal Topic</div><div>{#if record.proposal_topic}<span class="pd-chip">{record.proposal_topic}</span>{:else}-{/if}</div>
                <div>Annual Meeting</div><div>{fmt(record.meeting_date)} <span class="pd-muted">{record.meeting_date_known ? "Confirmed" : "Estimated"}</span></div>
              </div>
            </div>
            <div>
              <h4>SUBMITTED BY</h4>
              <div class="pd-grid">
                <div>Filer</div><div>{record.filer_name || "-"}</div>
                <div>Filer CIK</div><div>{record.filer_cik || "-"}</div>
                <div>Contact</div><div>{record.contact_name || "-"}</div>
                <div>Email</div><div>{#if record.contact_email}<a href={`mailto:${record.contact_email}`}>{record.contact_email}</a>{:else}-{/if}</div>
              </div>
            </div>
          </div>

          <h3 class="pd-wm">Written Materials</h3>
          <div class="pd-tabs">
            <button class:active={materialTab === "proposal"} onclick={() => (materialTab = "proposal")}>PROPOSAL ✓</button>
            <button class:active={materialTab === "exempt"} onclick={() => (materialTab = "exempt")}>EXEMPT SOLICITATION {exempt ? "✓" : "—"}</button>
            <button class:active={materialTab === "no_action"} onclick={() => (materialTab = "no_action")}>NO-ACTION {noAction ? "✓" : "—"}</button>
          </div>
          <div class="pd-mat">
            {#if materialTab === "proposal"}
              {#if record.pdf_s3_key}<a class="pd-pdf" href={`/${record.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(record.pdf_filename) || "Supporting document (PDF)"}</a>{/if}
              {#if record.proposal_text}<div class="pd-callout"><div class="pd-cl">RESOLVED CLAUSE</div>{record.proposal_text}</div>{:else}<p class="pd-muted">See the full proposal PDF above.</p>{/if}
            {:else if materialTab === "exempt"}
              {#if exempt}
                <div class="pd-grid">
                  <div>DEF 14A Link</div><div>{#if exempt.def14a_link}<a href={exempt.def14a_link} target="_blank" rel="noreferrer">{exempt.def14a_link}</a>{:else}Not provided{/if}</div>
                  <div>Item Number</div><div>{exempt.item_number || "-"}</div>
                  <div>Form Type</div><div>PX14A6G — Notice of Exempt Solicitation</div>
                </div>
                {#if exempt.pdf_s3_key}<a class="pd-pdf" href={`/${exempt.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(exempt.pdf_filename)}</a>{/if}
              {:else}<p class="pd-muted">No exempt solicitation on record</p>{/if}
            {:else}
              {#if noAction}
                <div class="pd-grid">
                  <div>Exclusion Basis</div>
                  <div>
                    {#if parseBases(noAction.exclusion_basis).length}
                      <span class="basis-inline">{parseBases(noAction.exclusion_basis).join(", ")}</span>
                    {:else}-{/if}
                  </div>
                  <div>Notice Date</div><div>{fmt(noAction.notice_date)}</div>
                </div>
                {#if noAction.company_letter_pdf_s3_key}<a class="pd-pdf" href={`/${noAction.company_letter_pdf_s3_key}`} target="_blank" rel="noreferrer">📄 Company letter — {cleanFileName(noAction.company_letter_pdf_filename)}</a>{/if}
                {#if noAction.response_pdf_s3_key}<a class="pd-pdf" href={`/${noAction.response_pdf_s3_key}`} target="_blank" rel="noreferrer">📄 Proponent response — {cleanFileName(noAction.response_pdf_filename)}</a>{/if}
              {:else}<p class="pd-muted">No no-action filing on record</p>{/if}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Attach a no-action / exempt solicitation to this proposal (owner only) -->
{#if record}
  <SubmitFilingModal bind:open={attachOpen} {user} initialMode={attachMode} lockedProposal={record} />
{/if}

{#snippet shareRow()}
  <div class="pd-share">
    <span class="pd-share-label">Share</span>
    <button class="pd-sbtn copy" title={copied ? "Copied!" : "Copy link"} aria-label="Copy link" onclick={copyLink}>
      {#if copied}
        <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12M8 13h8v-2H8v2m9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10"/></svg>
      {/if}
    </button>
    <a class="pd-sbtn li" href={liUrl} target="_blank" rel="noreferrer" title="Share on LinkedIn" aria-label="LinkedIn">
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14M8.34 17V9.74H6.03V17h2.31M7.18 8.48a1.34 1.34 0 1 0 0-2.68 1.34 1.34 0 0 0 0 2.68M18 17v-3.98c0-2.07-1.12-3.03-2.61-3.03-1.2 0-1.74.66-2.04 1.12v-.96h-2.31V17h2.31v-4.05c0-.21.02-.43.08-.58.17-.43.56-.87 1.21-.87.86 0 1.2.65 1.2 1.6V17H18Z"/></svg>
    </a>
    <a class="pd-sbtn x" href={xUrl} target="_blank" rel="noreferrer" title="Share on X" aria-label="X">
      <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M18.9 2H22l-7.3 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.8-8.9L1.5 2h6.8l4.7 6.2L18.9 2m-1.2 18h1.7L7.4 3.8H5.6L17.7 20Z"/></svg>
    </a>
    <a class="pd-sbtn fb" href={fbUrl} target="_blank" rel="noreferrer" title="Share on Facebook" aria-label="Facebook">
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg>
    </a>
    <span class="mail-wrap">
      <button class="pd-sbtn mail" title="Share by email" aria-label="Email" aria-haspopup="true" aria-expanded={mailMenuOpen} onclick={() => (mailMenuOpen = !mailMenuOpen)}>
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5-8-5V6l8 5 8-5v2Z"/></svg>
      </button>
      {#if mailMenuOpen}
        <span class="mail-menu" role="menu">
          <a role="menuitem" href={gmailUrl} target="_blank" rel="noreferrer" onclick={(e) => { e.preventDefault(); openCompose(gmailUrl); }}>Gmail</a>
          <a role="menuitem" href={outlookUrl} target="_blank" rel="noreferrer" onclick={(e) => { e.preventDefault(); openCompose(outlookUrl); }}>Outlook</a>
        </span>
      {/if}
    </span>
    {#if copied}<span class="pd-copied">Link copied</span>{/if}
  </div>
{/snippet}

<style>
  .pd-overlay {
    position: fixed; inset: 0; background: rgba(10, 20, 40, 0.6);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 16px; z-index: 1000; overflow-y: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .pd-modal { background: #f8f6f1; width: 100%; max-width: 860px; border-radius: 10px; overflow: hidden; box-shadow: 0 26px 72px rgba(0,0,0,0.35); }
  /* the dialog receives focus on open for accessibility, but it is a container,
     not a control — suppress the browser's blue focus ring on it (inner controls
     keep their own focus styles). */
  .pd-modal:focus, .pd-modal:focus-visible { outline: none; }
  .pd-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #1a3a5c; color: #fff; padding: 18px 26px; border-bottom: 3px solid #c8a84b; }
  .pd-head h3 { margin: 0; font-size: 18px; font-family: Georgia, "Times New Roman", serif; line-height: 1.25; }
  .pd-x { background: none; border: none; color: #fff; font-size: 26px; cursor: pointer; line-height: 1; flex-shrink: 0; opacity: 0.85; }
  .pd-x:hover { opacity: 1; }
  /* No inner scrollbar — the whole modal flows and the overlay scrolls, like the artifact. */
  .pd-body { padding: 28px 28px 32px; }
  .pd-company { margin: 8px 0 10px; font-size: 26px; line-height: 1.25; color: #1a3a5c; font-family: Georgia, "Times New Roman", serif; }
  .pd-date { font-size: 12px; color: #777; margin: 0 0 6px; }
  .pd-badge { display: inline-block; margin-left: 10px; padding: 2px 9px; border-radius: 10px; font-size: 11px; background: #fef3c7; color: #92400e; vertical-align: middle; white-space: nowrap; }
  .pd-badge.included { background: #d1fae5; color: #065f46; }
  .pd-badge.excluded { background: #fee2e2; color: #7f1d1d; }
  .pd-badge.withdrawn { background: #fde68a; color: #6b5300; }

  /* social share */
  .pd-share { display: flex; align-items: center; gap: 9px; margin: 16px 0 2px; }
  .pd-share-label {
    font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #9aa1ab; margin-right: 2px;
  }
  .pd-sbtn {
    width: 34px; height: 34px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid #d9dce2; background: #fff; color: #5a6472;
    cursor: pointer; text-decoration: none; padding: 0;
    transition: transform 0.15s ease, color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .pd-sbtn:hover { transform: translateY(-2px); }
  .pd-sbtn.copy:hover { color: #1a3a5c; border-color: #1a3a5c; }
  .pd-sbtn.li:hover { color: #fff; background: #0a66c2; border-color: #0a66c2; }
  .pd-sbtn.x:hover { color: #fff; background: #000; border-color: #000; }
  .pd-sbtn.fb:hover { color: #fff; background: #1877f2; border-color: #1877f2; }
  .pd-sbtn.mail:hover { color: #fff; background: #c8a84b; border-color: #c8a84b; }
  .pd-copied { font-size: 11px; color: #15803d; font-weight: 600; }

  /* Email-share dropdown (Gmail / Outlook / default mail app) */
  .mail-wrap { position: relative; display: inline-flex; }
  .mail-menu {
    position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);
    z-index: 50; min-width: 160px; padding: 5px;
    background: #fff; border: 1px solid #d9dce2; border-radius: 8px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.18); display: flex; flex-direction: column;
  }
  .mail-menu a {
    display: block; padding: 8px 12px; border-radius: 6px;
    font-size: 13px; color: #1f2937; text-decoration: none; white-space: nowrap;
  }
  .mail-menu a:hover { background: #eef2fb; color: #1a3a5c; }

  /* two-column header: company info left, owner panel top-right (like the artifact) */
  .pd-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
  .pd-header-left { flex: 1 1 300px; min-width: 260px; }

  /* "Your proposal" owner panel — matches the artifact (.owner-actions) exactly */
  .owner-actions {
    flex: 0 1 auto; align-self: flex-start; max-width: 480px;
    background: #fff; border: 1px solid var(--g2); border-left: 4px solid var(--gold);
    border-radius: 4px; padding: 12px 14px; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .owner-actions-label { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g4); }
  .owner-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .owner-actions .btn-sm { font-family: var(--mono); font-size: 11px; padding: 5px 12px; border-radius: 4px; cursor: pointer; border: 1px solid; text-transform: uppercase; letter-spacing: 0.04em; }
  .owner-actions .btn-view { background: #e8f0fe; color: var(--blue); border-color: var(--blue-light); }
  .owner-actions .btn-view:hover { background: #d8e6fd; }
  .owner-actions .btn-attached { background: var(--green-light); color: var(--green); border-color: var(--green-light); cursor: default; }
  .owner-status-inline { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
  .owner-status-row { display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--g5); }
  .owner-status-row select { font-family: var(--sans); font-size: 13px; padding: 5px 8px; border: 1.5px solid var(--g2); border-radius: 4px; background: #fff; }

  .pd-life { display: flex; justify-content: space-between; gap: 6px; margin: 20px 0 18px; padding: 18px 6px; }
  .pd-step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
  .pd-step:not(:last-child)::after { content: ""; position: absolute; top: 7px; left: 50%; width: 100%; height: 2px; background: #c3c9d2; z-index: 0; }
  /* completed steps carry a navy track to the next step, so progress reads clearly */
  .pd-step.done:not(:last-child)::after { background: #1a3a5c; }
  .pd-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #c3c9d2; background: #fbfaf7; z-index: 1; margin-bottom: 6px; }
  .pd-step.done .pd-dot { border-color: #1a3a5c; background: #1a3a5c; }
  .pd-l { font-size: 9.5px; letter-spacing: 0.02em; color: #6b7585; font-weight: 600; line-height: 1.2; }
  .pd-s { font-size: 10px; color: #9aa3af; margin-top: 2px; }

  .pd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 52px; margin-top: 16px; }
  h4 { margin: 0 0 12px; font-size: 12px; letter-spacing: 0.05em; color: #1a3a5c; border-bottom: 1px solid #e7e4dc; padding-bottom: 7px; }
  .pd-grid { display: grid; grid-template-columns: 130px 1fr; gap: 11px 16px; font-size: 13.5px; align-items: start; }
  .pd-grid > div:nth-child(odd) { color: #7a8699; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 2px; }
  .pd-grid > div:nth-child(even) { color: #1f2937; word-break: break-word; overflow-wrap: anywhere; }
  .pd-grid a { color: #27418a; }
  .pd-muted { color: #9aa3af; font-size: 12px; }
  .pd-chip { display: inline-block; background: #eef2fb; color: #27418a; font-size: 12px; padding: 2px 9px; border-radius: 4px; }

  .pd-wm { margin: 26px 0 12px; font-family: Georgia, "Times New Roman", serif; color: #1a3a5c; font-size: 18px; }
  .pd-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e3e6ea; }
  .pd-tabs button { background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 14px; font-size: 11.5px; letter-spacing: 0.02em; color: #6b7585; cursor: pointer; font-family: inherit; }
  .pd-tabs button.active { color: #1a3a5c; border-bottom-color: #c8a84b; font-weight: 600; }
  .pd-mat { border: 1px solid #ecece6; border-top: none; border-radius: 0 0 8px 8px; padding: 18px; background: #fff; }

  .pd-pdf { display: inline-block; background: #fde8e4; color: #b91c1c; padding: 7px 12px; border-radius: 6px; text-decoration: none; margin: 4px 0 10px; font-size: 13px; word-break: break-word; }
  .pd-callout { background: #eef2fb; border-left: 4px solid #27418a; padding: 12px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .basis-inline { color: #1f2937; line-height: 1.5; }
  .pd-cl { font-size: 11px; letter-spacing: 0.04em; color: #27418a; font-weight: 700; margin-bottom: 6px; }
  .pd-note { font-size: 12px; color: #777; background: #f5f3ee; border-radius: 6px; padding: 10px 12px; margin-top: 14px; }
  .pd-section { margin: 14px 0; }

  @media (max-width: 560px) { .pd-two { grid-template-columns: 1fr; } .pd-life { overflow-x: auto; } }
</style>
