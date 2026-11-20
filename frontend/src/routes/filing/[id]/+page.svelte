<script>
  import SubmitFilingModal from "$lib/SubmitFilingModal.svelte";
  import { parseBases } from "$lib/exclusionBases.js";
  import { cleanFileName } from "$lib/formatDate.js";

  let { data } = $props();
  const { record, exempt, noAction, isLegacy } = data;
  const user = data.user;
  const isOwner = !!(user && record && user.id === record.filer_user_id);

  // ── social share preview (OpenGraph / Twitter) ──
  // Canonical public site so crawlers (LinkedIn/Facebook/X) always get a
  // valid, publicly-fetchable absolute URL + image, regardless of environment.
  const CANONICAL = "https://proxyopenexchange.org";
  const ogTitle = (record?.company_name || record?.subject || "Shareholder Proposal") + " — Proxy Open Exchange";
  const ogDesc = record
    ? `${record.proposal_topic || record.subject || "Shareholder proxy filing"} · Filed on Proxy Open Exchange under SEC Rule 14a-8.`
    : "Shareholder proxy filings on Proxy Open Exchange.";
  const ogUrl = record ? `${CANONICAL}/filing/${record.id}` : CANONICAL;
  const ogImage = `${CANONICAL}/poe-share-image.png`;

  let materialTab = $state("proposal");
  let attachOpen = $state(false);
  let attachMode = $state("");
  let proxyStatus = $state(record?.proxy_status || "");
  let agmKnown = $state(record?.meeting_date_known ? "known" : "estimated");
  let saving = $state(false);

  function openAttach(mode) {
    attachMode = mode;
    attachOpen = true;
  }

  async function saveProxy() {
    saving = true;
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
    } finally {
      saving = false;
    }
  }

  const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-");
  const statusLabel = record?.proxy_status
    ? record.proxy_status.charAt(0).toUpperCase() + record.proxy_status.slice(1)
    : "Pending";

  // ── social share ──
  let copied = $state(false);
  // Share the canonical PRODUCTION url (see CANONICAL above) so LinkedIn/FB/X
  // can crawl it for the preview card, even when shared from staging.
  const shareUrl = record ? `${CANONICAL}/filing/${record.id}` : "";
  const shareTitle = record ? `${record.company_name || record.subject || "Shareholder Proposal"} — Proxy Open Exchange` : "";
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`;
  async function copyLink() {
    const confirm = () => { copied = true; setTimeout(() => (copied = false), 1800); };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-secure (HTTP) contexts where navigator.clipboard is unavailable.
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

<svelte:head>
  <title>{ogTitle}</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:site_name" content="Proxy Open Exchange" />
  <meta property="og:title" content={ogTitle} />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={ogUrl} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:alt" content="Proxy Open Exchange" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={ogTitle} />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="detail-page">
  <div class="card">
    <div class="card-head">
      <h3>
        {#if isLegacy}
          Exempt Solicitation — {record.subject || "-"}
        {:else}
          {record.company_name || "-"} — Shareholder Proposal
        {/if}
      </h3>
      <a class="x" href="/" aria-label="Close">×</a>
    </div>

    <div class="card-body">
      {#if isLegacy}
        <!-- ─── LEGACY STANDALONE EXEMPT SOLICITATION ─── -->
        <p class="date">Filed {fmt(record.created_at)}</p>
        <div class="section">
          <h4>PROXY INFORMATION</h4>
          <div class="grid">
            <div>Company</div><div>{record.memo_submitter || "-"}</div>
            <div>DEF 14A Filing</div><div>{#if record.def14a_link}<a href={record.def14a_link} target="_blank" rel="noreferrer">{record.def14a_link}</a>{:else}-{/if}</div>
            <div>Proposal Item</div><div>{record.item_number || "-"}</div>
            <div>Topic</div><div>{record.subject || "-"}</div>
            <div>Organization</div><div>{record.company_name || "-"}</div>
            <div>Contact</div><div>{record.contact_name || "-"} · {record.contact_email || "-"}</div>
          </div>
        </div>
        <div class="section">
          <h4>WRITTEN MATERIALS</h4>
          {#if record.pdf_s3_key}<a class="pdf-link" href={`/${record.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(record.pdf_filename)}</a>{/if}
        </div>
        <p class="legacy-note">This exempt solicitation was filed under POE Phase 1 as a standalone record. It is not linked to a parent proposal and has no no-action or proxy-status data.</p>

      {:else}
        <!-- ─── UNIFIED PROPOSAL DETAIL ─── -->
        <div class="top">
          <div class="top-left">
            <h2 class="company">{record.company_name || "-"}</h2>
            <p class="date">
              Filed: {fmt(record.created_at)} · Filer: {record.filer_name || "-"}
              <span class="badge {record.proxy_status || 'pending'}">{statusLabel}</span>
            </p>
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
          {/if}
        </div>

        <div class="pd-share">
          <span class="pd-share-label">Share</span>
          <button class="pd-sbtn copy" title={copied ? "Copied!" : "Copy link"} aria-label="Copy link" onclick={copyLink}>
            {#if copied}
              <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            {:else}
              <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12M8 13h8v-2H8v2m9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10"/></svg>
            {/if}
          </button>
          <a class="pd-sbtn li" href={liUrl} target="_blank" rel="noreferrer" title="Share on LinkedIn" aria-label="LinkedIn"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14M8.34 17V9.74H6.03V17h2.31M7.18 8.48a1.34 1.34 0 1 0 0-2.68 1.34 1.34 0 0 0 0 2.68M18 17v-3.98c0-2.07-1.12-3.03-2.61-3.03-1.2 0-1.74.66-2.04 1.12v-.96h-2.31V17h2.31v-4.05c0-.21.02-.43.08-.58.17-.43.56-.87 1.21-.87.86 0 1.2.65 1.2 1.6V17H18Z"/></svg></a>
          <a class="pd-sbtn x" href={xUrl} target="_blank" rel="noreferrer" title="Share on X" aria-label="X"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M18.9 2H22l-7.3 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.8-8.9L1.5 2h6.8l4.7 6.2L18.9 2m-1.2 18h1.7L7.4 3.8H5.6L17.7 20Z"/></svg></a>
          <a class="pd-sbtn fb" href={fbUrl} target="_blank" rel="noreferrer" title="Share on Facebook" aria-label="Facebook"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg></a>
          <a class="pd-sbtn mail" href={mailUrl} title="Share by email" aria-label="Email"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5-8-5V6l8 5 8-5v2Z"/></svg></a>
          {#if copied}<span class="pd-copied">Link copied</span>{/if}
        </div>

        <!-- LIFECYCLE STRIP -->
        <div class="lifecycle">
          <div class="step done">
            <span class="dot"></span><span class="step-label">PROPOSAL FILED</span>
            <span class="step-sub">{fmt(record.created_at)}</span>
          </div>
          <div class="step {noAction ? 'done' : ''}">
            <span class="dot"></span><span class="step-label">NO-ACTION</span>
            <span class="step-sub">{noAction ? (noAction.notice_date ? fmt(noAction.notice_date) : "Filed") : "None on record"}</span>
          </div>
          <div class="step {record.proxy_status ? 'done' : ''}">
            <span class="dot"></span><span class="step-label">EXCLUSION</span>
            <span class="step-sub">{record.proxy_status ? statusLabel : "Not yet known"}</span>
          </div>
          <div class="step {exempt ? 'done' : ''}">
            <span class="dot"></span><span class="step-label">EXEMPT SOLICITATION</span>
            <span class="step-sub">{exempt ? "Filed" : "None on record"}</span>
          </div>
          <div class="step {record.meeting_date_known ? 'done' : ''}">
            <span class="dot"></span><span class="step-label">{record.meeting_date_known ? "AGM DATE" : "EST. AGM DATE"}</span>
            <span class="step-sub">{fmt(record.meeting_date)}</span>
          </div>
        </div>

        <!-- COMPANY + SUBMITTED BY -->
        <div class="two-col">
          <div>
            <h4>COMPANY</h4>
            <div class="grid">
              <div>Company</div><div>{record.company_name || "-"}</div>
              <div>Registrant CIK</div><div>{record.company_cik || "-"}</div>
              <div>Proposal Topic</div><div>{#if record.proposal_topic}<span class="topic-chip">{record.proposal_topic}</span>{:else}-{/if}</div>
              <div>Annual Meeting</div><div>{fmt(record.meeting_date)} <span class="muted">{record.meeting_date_known ? "Confirmed" : "Estimated"}</span></div>
            </div>
          </div>
          <div>
            <h4>SUBMITTED BY</h4>
            <div class="grid">
              <div>Filer</div><div>{record.filer_name || "-"}</div>
              <div>Filer CIK</div><div>{record.filer_cik || "-"}</div>
              <div>Contact</div><div>{record.contact_name || "-"}</div>
              <div>Email</div><div>{#if record.contact_email}<a href={`mailto:${record.contact_email}`}>{record.contact_email}</a>{:else}-{/if}</div>
            </div>
          </div>
        </div>

        <!-- WRITTEN MATERIALS -->
        <h3 class="wm-title">Written Materials</h3>
        <div class="mat-tabs">
          <button class:active={materialTab === "proposal"} onclick={() => (materialTab = "proposal")}>PROPOSAL ✓</button>
          <button class:active={materialTab === "exempt"} onclick={() => (materialTab = "exempt")}>EXEMPT SOLICITATION {exempt ? "✓" : "—"}</button>
          <button class:active={materialTab === "no_action"} onclick={() => (materialTab = "no_action")}>NO-ACTION {noAction ? "✓" : "—"}</button>
        </div>

        <div class="mat-box">
          {#if materialTab === "proposal"}
            {#if record.pdf_s3_key}<a class="pdf-link" href={`/${record.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(record.pdf_filename) || "Supporting document (PDF)"}</a>{/if}
            {#if record.proposal_text}
              <div class="callout"><div class="callout-label">RESOLVED CLAUSE</div>{record.proposal_text}</div>
            {:else}<p class="muted">See the full proposal PDF above.</p>{/if}
          {:else if materialTab === "exempt"}
            {#if exempt}
              <div class="grid">
                <div>DEF 14A Link</div><div>{#if exempt.def14a_link}<a href={exempt.def14a_link} target="_blank" rel="noreferrer">{exempt.def14a_link}</a>{:else}Not provided{/if}</div>
                <div>Item Number</div><div>{exempt.item_number || "-"}</div>
                <div>Form Type</div><div>PX14A6G — Notice of Exempt Solicitation</div>
              </div>
              {#if exempt.pdf_s3_key}<a class="pdf-link" href={`/${exempt.pdf_s3_key}`} target="_blank" rel="noreferrer">📄 {cleanFileName(exempt.pdf_filename)}</a>{/if}
            {:else}<p class="muted">No exempt solicitation on record</p>{/if}
          {:else}
            {#if noAction}
              <div class="grid">
                <div>Exclusion Basis</div>
                <div>
                  {#if parseBases(noAction.exclusion_basis).length}
                    <span class="basis-inline">{parseBases(noAction.exclusion_basis).join(", ")}</span>
                  {:else}-{/if}
                </div>
                <div>Notice Date</div><div>{fmt(noAction.notice_date)}</div>
              </div>
              {#if noAction.company_letter_pdf_s3_key}<a class="pdf-link" href={`/${noAction.company_letter_pdf_s3_key}`} target="_blank" rel="noreferrer">📄 Company letter — {cleanFileName(noAction.company_letter_pdf_filename)}</a>{/if}
              {#if noAction.response_pdf_s3_key}<a class="pdf-link" href={`/${noAction.response_pdf_s3_key}`} target="_blank" rel="noreferrer">📄 Proponent response — {cleanFileName(noAction.response_pdf_filename)}</a>{/if}
            {:else}<p class="muted">No no-action filing on record</p>{/if}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if isOwner}
  <SubmitFilingModal bind:open={attachOpen} user={data.user} initialMode={attachMode} lockedProposal={record} />
{/if}

<style>
  .basis-inline { color: #1f2937; line-height: 1.5; }
  .detail-page { background: #eceae4; min-height: 100vh; padding: 30px 16px; }
  .card {
    max-width: 680px; margin: 0 auto; background: #fbfaf7;
    border-radius: 10px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.12);
    font-family: var(--mono, ui-monospace, monospace);
  }
  .card-head {
    display: flex; align-items: center; justify-content: space-between;
    background: #13294b; color: #fff; padding: 16px 20px; border-bottom: 3px solid #c8a84b;
  }
  .card-head h3 { margin: 0; font-size: 17px; font-family: Georgia, serif; }
  .x { color: #fff; text-decoration: none; font-size: 22px; line-height: 1; }
  .card-body { padding: 22px 24px; }

  .top { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
  .company { margin: 0; font-size: 22px; color: #13294b; font-family: Georgia, serif; }
  .date { font-size: 12px; color: #777; margin: 6px 0 0; }
  .badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #fef3c7; color: #92400e; }
  .badge.included { background: #d1fae5; color: #065f46; }
  .badge.excluded { background: #fee2e2; color: #7f1d1d; }
  .badge.withdrawn { background: #e5e7eb; color: #374151; }

  /* social share */
  .pd-share { display: flex; align-items: center; gap: 9px; margin: 14px 0 2px; }
  .pd-share-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #9aa1ab; margin-right: 2px; }
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

  /* "Your proposal" owner panel — matches the artifact (.owner-actions) exactly */
  .owner-actions {
    align-self: flex-start; max-width: 480px;
    background: #fff; border: 1px solid var(--g2); border-left: 4px solid var(--gold);
    border-radius: 4px; padding: 12px 14px; min-width: 260px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .owner-actions-label { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g4); }
  .owner-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .owner-actions .btn-sm { font-family: var(--mono); font-size: 11px; padding: 5px 12px; border-radius: 4px; cursor: pointer; border: 1px solid; text-transform: uppercase; letter-spacing: 0.04em; }
  .owner-actions .btn-view { background: #e8f0fe; color: var(--blue); border-color: var(--blue-light); }
  .owner-actions .btn-view:hover { background: #d8e6fd; }
  .owner-actions .btn-attached { background: var(--green-light); color: var(--green); border-color: var(--green-light); cursor: default; }
  .owner-status-row { display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--g5); }
  .owner-status-row select { font-family: var(--sans); font-size: 13px; padding: 5px 8px; border: 1.5px solid var(--g2); border-radius: 4px; background: #fff; }

  .lifecycle { display: flex; justify-content: space-between; gap: 6px; margin: 20px 0 10px; padding: 14px 4px; }
  .lifecycle .step { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
  .lifecycle .step:not(:last-child)::after { content: ""; position: absolute; top: 7px; left: 50%; width: 100%; height: 2px; background: #e3e0d8; z-index: 0; }
  .lifecycle .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #c3c9d2; background: #fbfaf7; z-index: 1; margin-bottom: 6px; }
  .lifecycle .step.done .dot { border-color: #13294b; background: #13294b; }
  .lifecycle .step-label { font-size: 9.5px; letter-spacing: 0.02em; color: #6b7585; font-weight: 600; line-height: 1.2; }
  .lifecycle .step-sub { font-size: 10px; color: #9aa3af; margin-top: 2px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; margin-top: 12px; }
  h4 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.04em; color: #13294b; border-bottom: 1px solid #e7e4dc; padding-bottom: 5px; }
  .grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; font-size: 13px; align-items: start; }
  .grid > div:nth-child(odd) { color: #7a8699; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; padding-top: 2px; }
  .grid > div:nth-child(even) { color: #1f2937; word-break: break-word; overflow-wrap: anywhere; }
  .grid a, .value a { color: #27418a; }
  .muted { color: #9aa3af; font-size: 12px; }
  .topic-chip { display: inline-block; background: #eef2fb; color: #27418a; font-size: 12px; padding: 2px 9px; border-radius: 4px; }

  .wm-title { margin: 22px 0 10px; font-family: Georgia, serif; color: #13294b; font-size: 18px; }
  .mat-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e3e6ea; }
  .mat-tabs button { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 12px; font-size: 11px; color: #6b7585; cursor: pointer; font-family: inherit; }
  .mat-tabs button.active { color: #13294b; border-bottom-color: #c8a84b; font-weight: 600; }
  .mat-box { border: 1px solid #ecece6; border-top: none; border-radius: 0 0 8px 8px; padding: 16px; background: #fff; }

  .pdf-link { display: inline-block; background: #fde8e4; color: #b91c1c; padding: 7px 12px; border-radius: 6px; text-decoration: none; margin: 4px 0 10px; font-size: 13px; word-break: break-word; }
  .callout { background: #eef2fb; border-left: 4px solid #27418a; padding: 12px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .callout-label { font-size: 11px; letter-spacing: 0.04em; color: #27418a; font-weight: 700; margin-bottom: 6px; }
  .legacy-note { font-size: 12px; color: #777; background: #f5f3ee; border-radius: 6px; padding: 10px 12px; margin-top: 14px; }

  .section { margin: 14px 0; }

  @media (max-width: 560px) {
    .two-col { grid-template-columns: 1fr; }
    .lifecycle { overflow-x: auto; }
  }
</style>
