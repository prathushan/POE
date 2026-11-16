<script>
  import { onMount } from "svelte";
  let { data } = $props();
  let user = $state(data.user);

  // ─── Submission mode: "", "new", "no_action", "exempt" ───
  let mode = $state("");

  // ─── Shared / new-proposal fields ───
  let company_name = $state("");
  let registrant_cik = $state("");
  let proposal_topic = $state("");
  let proposal_topic_other = $state("");
  let proposal_text = $state("");
  let meeting_date = $state("");
  let meeting_date_known = $state(false); // false = Estimated (default), true = Known

  // ─── Attach modes: parent proposal ───
  let parent_proposal_id = $state("");

  // ─── No-action / exclusion fields ───
  let exclusion_basis = $state("");
  let notice_date = $state("");

  // ─── Exempt solicitation fields ───
  let def14a_link = $state("");
  let item_number = $state("");
  let voluntary_5m = $state(false);

  // ─── File uploads ───
  let primary_file = $state(null);   // new proposal: supporting PDF / exempt: proxy memo / no-action: company letter
  let second_file = $state(null);    // no-action: proponent response

  // ─── Certification ───
  let certify = $state(false);

  // Dropdown option lists (from Phase 2 scope)
  const TOPICS = [
    "Energy & Climate",
    "Human / Community Rights",
    "Data Privacy",
    "Circular Economy",
    "Board Governance / Voting Structure",
    "CEO Pay",
    "Political Spending / Lobbying",
    "Environmental Health",
    "Worker Safety / Labor",
    "Human Resources / Diversity",
    "Other",
  ];

  const EXCLUSION_BASES = [
    "(i)(1) — Improper under state law",
    "(i)(2) — Would cause company to violate law",
    "(i)(3) — Violation of proxy rules",
    "(i)(4) — Personal grievance",
    "(i)(5) — Relevance (less than 5% of assets)",
    "(i)(6) — Company lacks authority to implement",
    "(i)(7) — Relates to ordinary business / management functions",
    "(i)(8) — Relates to board election",
    "(i)(9) — Conflicts with company's own proposal",
    "(i)(10) — Substantially implemented",
    "(i)(11) — Duplication",
    "(i)(12) — Resubmission (below vote threshold)",
    "(i)(13) — Specific amount of dividends",
    "Unknown",
  ];

  // The current user's own approved proposals, for the "Link to Proposal" dropdown.
  // Wired to a real endpoint in the next step (after the DB migration).
  let myProposals = $state([]);

  onMount(async () => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      const res = await fetch("/api/user/me", { headers: { "x-user": stored } });
      user = await res.json();
    } catch (err) {
      console.error("USER LOAD ERROR:", err);
    }
  });

  function handlePrimary(e) { primary_file = e.target.files[0]; }
  function handleSecond(e) { second_file = e.target.files[0]; }

  // Reset the form whenever the mode changes (scope: "resets each time the form opens")
  function onModeChange() {
    company_name = "";
    registrant_cik = "";
    proposal_topic = "";
    proposal_topic_other = "";
    proposal_text = "";
    meeting_date = "";
    meeting_date_known = false;
    parent_proposal_id = "";
    exclusion_basis = "";
    notice_date = "";
    def14a_link = "";
    item_number = "";
    voluntary_5m = false;
    primary_file = null;
    second_file = null;
    certify = false;
  }

  // NOTE: saving is wired to the backend in the next step (after the DB migration
  // that adds the Phase 2 columns). For now this previews the flow.
  function submitFiling() {
    alert(
      "Form UI only for now — saving is wired up in the next step, right after the database migration that adds the Phase 2 columns."
    );
  }
</script>

<svelte:head>
  <title>POE | Submit a Filing</title>
</svelte:head>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-logo">POE</div>
    <h2>Submit a Filing</h2>

    <!-- ─────────────── SUBMISSION MODE ─────────────── -->
    <div class="mode-box">
      <label>What would you like to do? <span class="req">*</span></label>
      <select bind:value={mode} onchange={onModeChange}>
        <option value="">— Select —</option>
        <option value="new">File a new shareholder proposal</option>
        <option value="no_action">Attach a no-action / exclusion notice to one of my proposals</option>
        <option value="exempt">Attach an exempt solicitation to one of my proposals</option>
      </select>
      <p class="tip">
        Tip: you can also open any of your proposals from the filing index and
        attach documents directly from its detail page.
      </p>
    </div>

    {#if mode === "new" || mode === "no_action" || mode === "exempt"}
      <!-- ─────────────── AUTO-FILLED FILER INFO (read-only) ─────────────── -->
      {#if data.user}
        <div class="inherited-block">
          <label>Filer / Proponent Name</label>
          <input value={data.user.org_name} readonly />
          <label>Filer CIK</label>
          <input value={data.user.cik} readonly />
          <label>Contact Name</label>
          <input value={data.user.contact_name ?? ""} readonly />
          <label>Contact Email</label>
          <input value={data.user.email ?? ""} readonly />
          <p class="tip">
            Filer details come from your account.
            <a href="/dashboard">Update account settings</a>.
          </p>
        </div>
      {/if}
    {/if}

    <!-- ═════════════════ MODE: NEW PROPOSAL ═════════════════ -->
    {#if mode === "new"}
      <label>Company Name <span class="req">*</span></label>
      <input bind:value={company_name} placeholder="Start typing a company already on POE…" />

      <label>Registrant CIK <span class="req">*</span></label>
      <input bind:value={registrant_cik} placeholder="e.g. 0000320193" />

      <label>Proposal Topic <span class="req">*</span></label>
      <select bind:value={proposal_topic}>
        <option value="">— Select a topic —</option>
        {#each TOPICS as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
      {#if proposal_topic === "Other"}
        <input bind:value={proposal_topic_other} placeholder="Describe the topic" />
      {/if}

      <label>Proposal Text <span class="optional">(optional)</span></label>
      <textarea bind:value={proposal_text} rows="4"
        placeholder="Resolved: Shareholders request that…"></textarea>
      <p class="helper">
        Entering the full Resolved clause can help your proposal appear in search
        engines like Google, making it easier for investors and researchers to find.
      </p>

      <label>Estimated Annual Meeting Date <span class="req">*</span></label>
      <input type="date" bind:value={meeting_date} />
      <div class="radio-row">
        <label class="radio"><input type="radio" value={false} bind:group={meeting_date_known} /> Estimated</label>
        <label class="radio"><input type="radio" value={true} bind:group={meeting_date_known} /> Known</label>
      </div>

      <label>Supporting Document (full proposal PDF) <span class="req">*</span></label>
      <input type="file" accept="application/pdf" onchange={handlePrimary} />
    {/if}

    <!-- ═════════════════ MODE: NO-ACTION / EXCLUSION ═════════════════ -->
    {#if mode === "no_action"}
      <label>Link to Proposal <span class="req">*</span></label>
      <select bind:value={parent_proposal_id} disabled={myProposals.length === 0}>
        <option value="">— Select one of your proposals —</option>
        {#each myProposals as p}
          <option value={p.id}>{p.company_name} — {p.proposal_topic}</option>
        {/each}
      </select>
      {#if myProposals.length === 0}
        <p class="helper">Your approved proposals will appear here (wired after the DB step).</p>
      {/if}

      <label>Exclusion Basis <span class="req">*</span></label>
      <select bind:value={exclusion_basis}>
        <option value="">— Select the 14a-8(i) basis —</option>
        {#each EXCLUSION_BASES as b}
          <option value={b}>{b}</option>
        {/each}
      </select>

      <label>No-Action Notice Date <span class="req">*</span></label>
      <input type="date" bind:value={notice_date} />

      <label>Company Exclusion Letter (PDF) <span class="optional">(optional)</span></label>
      <input type="file" accept="application/pdf" onchange={handlePrimary} />

      <label>Proponent Response (PDF) <span class="optional">(optional)</span></label>
      <input type="file" accept="application/pdf" onchange={handleSecond} />
    {/if}

    <!-- ═════════════════ MODE: EXEMPT SOLICITATION ═════════════════ -->
    {#if mode === "exempt"}
      <label>Link to Proposal <span class="req">*</span></label>
      <select bind:value={parent_proposal_id} disabled={myProposals.length === 0}>
        <option value="">— Select one of your proposals —</option>
        {#each myProposals as p}
          <option value={p.id}>{p.company_name} — {p.proposal_topic}</option>
        {/each}
      </select>
      {#if myProposals.length === 0}
        <p class="helper">Your approved proposals will appear here (wired after the DB step).</p>
      {/if}

      <label>Company Proxy Statement Link (DEF 14A) <span class="req">*</span></label>
      <input bind:value={def14a_link} placeholder="SEC filing link" />

      <label>Item Number <span class="optional">(optional)</span></label>
      <input bind:value={item_number} placeholder="Proxy-statement item number" />

      <label>Exempt Solicitation (Proxy Memo) PDF <span class="req">*</span></label>
      <input type="file" accept="application/pdf" onchange={handlePrimary} />

      <label class="checkbox-row">
        <input type="checkbox" bind:checked={voluntary_5m} />
        <span>I am voluntarily filing although I beneficially own securities valued over $5 million. <span class="req">*</span></span>
      </label>
    {/if}

    <!-- ─────────────── CERTIFICATION + SUBMIT (any mode) ─────────────── -->
    {#if mode}
      <label class="checkbox-row certify">
        <input type="checkbox" bind:checked={certify} />
        <span>I certify the information is accurate and acknowledge the
          <a href="/terms" class="terms-link">Terms of Use</a>.</span>
      </label>

      <button class="btn-auth" onclick={submitFiling}>Submit Filing</button>
    {/if}
  </div>
</div>

<style>
  .req { color: red; }
  .optional { color: #888; font-weight: normal; font-size: 12px; }

  .mode-box { margin-bottom: 18px; }
  .tip { font-size: 12px; color: #666; margin-top: 6px; }
  .helper { font-size: 12px; color: #666; margin-top: 4px; }

  select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    font-size: 14px;
  }

  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }

  .inherited-block {
    background: #f6f7f9;
    border: 1px solid #e3e6ea;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .inherited-block input[readonly] { background: #eef0f3; color: #555; }

  .radio-row { display: flex; gap: 20px; margin: 6px 0 4px; }
  .radio { display: flex; align-items: center; gap: 6px; font-size: 13px; }

  .checkbox-row {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: start;
    column-gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    margin-top: 10px;
  }
  .checkbox-row.certify { margin-top: 16px; }
</style>
