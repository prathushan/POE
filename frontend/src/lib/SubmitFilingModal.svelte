<script>
  import { EXCLUSION_BASES } from "$lib/exclusionBases.js";
  import { fmtDate } from "$lib/formatDate.js";

  let { open = $bindable(false), user = null, initialMode = "", lockedProposal = null } = $props();

  // When opened with a preset mode (from a proposal's "+ Attach" buttons),
  // preselect the mode and lock the parent proposal.
  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen && initialMode) {
      mode = initialMode;
      if (lockedProposal) {
        myProposals = [lockedProposal];
        parent_proposal_id = lockedProposal.id;
        proposalSearch = `${lockedProposal.company_name} — ${lockedProposal.proposal_topic ?? ""}`;
      } else {
        onModeChange();
      }
    }
    prevOpen = open;
  });

  // mode: "" | new | no_action | exempt | standalone
  let mode = $state("");

  // ── New proposal ──
  let company_name = $state("");
  let registrant_cik = $state("");
  let proposal_topic = $state("");
  let proposal_topic_other = $state("");
  let meeting_date = $state("");        // canonical yyyy-mm-dd (sent to the backend)
  let meetingDateInput = $state("");    // what the user sees/types: mm/dd/yyyy
  let meeting_date_known = $state(false);

  // Date helpers — the field shows US mm/dd/yyyy regardless of browser locale.
  function isoToMdy(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return y && m && d ? `${m}/${d}/${y}` : "";
  }
  function mdyToIso(mdy) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((mdy || "").trim());
    if (!m) return "";
    const [, mm, dd, yyyy] = m;
    if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return "";
    return `${yyyy}-${mm}-${dd}`;
  }
  // Auto-insert slashes as the user types: "05242027" -> "05/24/2027".
  function formatMdy(raw) {
    let v = (raw || "").replace(/[^\d]/g, "").slice(0, 8);
    if (v.length >= 5) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
    else if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    return v;
  }
  // Open the native calendar picker for a mm/dd/yyyy field (icon click).
  function openDatePicker(e) {
    const native = e.currentTarget.closest(".date-field")?.querySelector('input[type="date"]');
    if (!native) return;
    try { native.showPicker(); } catch { native.focus(); }
  }
  let proposal_text = $state("");
  let proxy_status = $state("");

  // ── Company typeahead (New Proposal) ──
  // Match ignoring spaces/punctuation so "PaloAlto" finds "Palo Alto Networks, Inc."
  const normName = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  let companies = $state([]);
  let companiesLoaded = false;
  let showCompanyDd = $state(false);
  let companyResults = $derived(
    company_name.trim().length >= 2
      ? companies
          .filter((c) => normName(c.company_name).includes(normName(company_name)))
          .slice(0, 8)
      : []
  );
  async function loadCompanies() {
    if (companiesLoaded) return;
    companiesLoaded = true;
    try {
      const res = await fetch("/api/filings/companies");
      companies = res.ok ? await res.json() : [];
    } catch {
      companies = [];
    }
  }
  // Suggest next year's AGM: same month/day, year + 1. Works purely on the
  // YYYY-MM-DD string so it never shifts the day across timezones (toISOString
  // would convert to UTC and move the day in +offset zones like IST).
  function suggestAgm(d) {
    if (!d) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d).slice(0, 10));
    if (!m) return "";
    return `${Number(m[1]) + 1}-${m[2]}-${m[3]}`;
  }
  function pickCompany(c) {
    company_name = c.company_name;
    registrant_cik = c.company_cik || "";
    if (c.meeting_date) {
      meeting_date = suggestAgm(c.meeting_date);
      meetingDateInput = isoToMdy(meeting_date);
      meeting_date_known = false;
    }
    edgarResults = [];
    showCompanyDd = false;
  }

  // ── EDGAR fallback (scope §8): registrants not yet on POE ──
  let edgarResults = $state([]);
  let edgarTimer;
  function lookupEdgar(q) {
    clearTimeout(edgarTimer);
    const term = (q || "").trim();
    if (term.length < 3) { edgarResults = []; return; }
    edgarTimer = setTimeout(async () => {
      try {
        const res = await fetch("/api/filings/edgar-lookup?q=" + encodeURIComponent(term));
        const data = res.ok ? await res.json() : [];
        // hide EDGAR rows for companies already surfaced from POE (by CIK)
        const poeCiks = new Set(companies.map((c) => (c.company_cik || "").padStart(10, "0")));
        edgarResults = data.filter((c) => !poeCiks.has(c.company_cik)).slice(0, 6);
      } catch {
        edgarResults = [];
      }
    }, 300);
  }
  function pickEdgar(c) {
    company_name = c.company_name;
    registrant_cik = c.company_cik || "";
    edgarResults = [];
    showCompanyDd = false;
  }

  // ── Attach modes ──
  let parent_proposal_id = $state("");
  let proposalSearch = $state("");
  let myProposals = $state([]);

  // ── Edit mode (round-2 §7/§8): the proposal being edited ──
  let edit_id = $state("");

  // ── No-action ──
  let exclusion_bases = $state([]);
  let basisDdOpen = $state(false); // multi-select exclusion-basis dropdown open/closed
  let proposalDdOpen = $state(false); // "select your proposal" / "edit" search dropdown open/closed
  function toggleBasis(b) {
    exclusion_bases = exclusion_bases.includes(b)
      ? exclusion_bases.filter((x) => x !== b)
      : [...exclusion_bases, b];
  }
  let notice_date = $state("");         // canonical yyyy-mm-dd
  let noticeDateInput = $state("");     // shown as mm/dd/yyyy

  // ── Exempt / standalone ──
  let def14a_link = $state("");
  let item_number = $state("");
  let voluntary_5m = $state(false);
  // round-2 §6: optionally confirm the proposal's AGM date from the exempt form
  let exempt_agm_date = $state("");     // canonical yyyy-mm-dd
  let exemptAgmInput = $state("");      // shown as mm/dd/yyyy

  // ── Standalone (legacy) extra ──
  let std_company = $state("");
  let std_topic = $state("");
  let std_contact = $state("");
  let std_5m_ack = $state(false);

  // ── Files ──
  let primary_file = $state(null);
  let second_file = $state(null);

  let certify = $state(false);
  // round-2 §5: filer flags interest in Proxy Preview 2027 (admin can see/sort)
  let proxyPreviewInterest = $state(false);
  let submitting = $state(false);

  const TOPICS = [
    "Energy & Climate","Human / Community Rights","Data Privacy","Circular Economy",
    "Board Governance / Voting Structure","CEO Pay","Political Spending / Lobbying",
    "Environmental Health","Worker Safety / Labor","Human Resources / Diversity","Other",
  ];

  const titles = {
    "": "Submit a Filing",
    new: "Submit a New Shareholder Proposal",
    no_action: "Add No-Action/Exclusion to Proposal",
    exempt: "Add Exempt Solicitation to Proposal",
    edit: "Edit a Submitted Proposal",
    standalone: "Submit a Standalone Exempt Solicitation",
  };

  let filteredProposals = $derived(
    proposalSearch.trim()
      ? myProposals.filter((p) =>
          `${p.company_name} ${p.proposal_topic ?? ""}`
            .toLowerCase()
            .includes(proposalSearch.toLowerCase()))
      : myProposals
  );

  // the currently-selected parent proposal (for inherited, read-only fields)
  let selectedProposal = $derived(
    parent_proposal_id
      ? myProposals.find((p) => p.id === parent_proposal_id) ||
        (lockedProposal && lockedProposal.id === parent_proposal_id ? lockedProposal : null)
      : null
  );

  async function onModeChange() {
    resetFields();
    if (mode === "new") loadCompanies();
    if (mode === "no_action" || mode === "exempt") {
      try {
        const res = await fetch("/api/filings/my-proposals");
        myProposals = res.ok ? await res.json() : [];
      } catch { myProposals = []; }
    }
    if (mode === "edit") {
      loadCompanies(); // same company typeahead as "new"
      try {
        const res = await fetch("/api/filings/my-proposals?all=1");
        myProposals = res.ok ? await res.json() : [];
      } catch { myProposals = []; }
    }
  }

  // Pick a proposal to EDIT → load its current values into the form.
  function pickForEdit(p) {
    edit_id = p.id;
    proposalSearch = `${p.company_name} — ${p.proposal_topic ?? ""}`;
    company_name = p.company_name ?? "";
    registrant_cik = p.company_cik ?? "";
    const known = TOPICS.includes(p.proposal_topic);
    proposal_topic = known ? p.proposal_topic : (p.proposal_topic ? "Other" : "");
    proposal_topic_other = known ? "" : (p.proposal_topic ?? "");
    proposal_text = p.proposal_text ?? "";
    meeting_date = p.meeting_date ? String(p.meeting_date).slice(0, 10) : "";
    meetingDateInput = isoToMdy(meeting_date);
    meeting_date_known = !!p.meeting_date_known;
    proxy_status = p.proxy_status ?? "";
    primary_file = null; // keep existing PDF unless they upload a new one
    proposalDdOpen = false; // close the search dropdown after picking
  }

  function resetFields() {
    company_name = registrant_cik = proposal_topic = proposal_topic_other = "";
    meeting_date = ""; meetingDateInput = ""; meeting_date_known = false; proposal_text = ""; proxy_status = "";
    parent_proposal_id = ""; proposalSearch = ""; edit_id = ""; proposalDdOpen = false;
    exclusion_bases = []; notice_date = ""; noticeDateInput = ""; basisDdOpen = false;
    def14a_link = ""; item_number = ""; voluntary_5m = false; exempt_agm_date = ""; exemptAgmInput = "";
    std_company = ""; std_topic = ""; std_contact = ""; std_5m_ack = false;
    primary_file = null; second_file = null; certify = false;
    proxyPreviewInterest = false;
    edgarResults = [];
  }

  function close() {
    open = false;
    mode = "";
    resetFields();
  }

  function pickProposal(p) {
    parent_proposal_id = p.id;
    proposalSearch = `${p.company_name} — ${p.proposal_topic ?? ""}`;
    proposalDdOpen = false; // close the search dropdown after picking
  }

  // Proxy Preview 2027 contribution link. As You Sow will supply the destination
  // URL before launch (scope appendix Q6). Leave "" until provided — the message
  // still renders, with the link shown as "coming soon".
  const PROXY_PREVIEW_URL = "";

  let confirmOpen = $state(false);
  // which success message to show in the styled confirmation popup
  let successKind = $state("proposal"); // "proposal" | "no_action" | "exempt" | "standalone" | "edit"
  const successHeadline = $derived(
    successKind === "no_action" ? "No Action Submitted Successfully"
      : successKind === "exempt" ? "Exempt Solicitation Submitted Successfully"
      : successKind === "standalone" ? "Filing Submitted Successfully"
      : successKind === "edit" ? "Proposal Updated Successfully"
      : "Proposal Submitted Successfully"
  );
  function closeConfirm() {
    confirmOpen = false;
    window.location.reload();
  }

  // Inline (no-popup) confirmation shown after attaching a document.
  let attachNotice = $state("");

  async function submitFiling() {
    if (!user) { alert("Please sign in first."); return; }
    if (!certify) { alert("Please tick the certification box."); return; }

    const fd = new FormData();
    fd.append("mode", mode);

    if (mode === "new") {
      if (!company_name || !registrant_cik || !proposal_topic || !meeting_date || !primary_file) {
        alert("Please fill all required (*) fields and upload the supporting PDF."); return;
      }
      fd.append("company_name", company_name);
      fd.append("registrant_cik", registrant_cik);
      fd.append("proposal_topic", proposal_topic === "Other" ? proposal_topic_other : proposal_topic);
      fd.append("proposal_text", proposal_text);
      fd.append("meeting_date", meeting_date);
      fd.append("meeting_date_known", meeting_date_known);
      fd.append("proxy_status", proxy_status);
      fd.append("proxy_preview_interest", proxyPreviewInterest);
      fd.append("primary_file", primary_file);
    } else if (mode === "no_action") {
      if (!parent_proposal_id || exclusion_bases.length === 0) {
        alert("Please select a proposal and at least one exclusion basis."); return;
      }
      fd.append("proposal_id", parent_proposal_id);
      fd.append("exclusion_basis", JSON.stringify(exclusion_bases));
      fd.append("notice_date", notice_date);
      if (primary_file) fd.append("company_letter_file", primary_file);
      if (second_file) fd.append("response_file", second_file);
    } else if (mode === "exempt") {
      if (!parent_proposal_id || !voluntary_5m || !primary_file) {
        alert("Please select a proposal, tick the $5M box, and upload the PDF."); return;
      }
      fd.append("proposal_id", parent_proposal_id);
      fd.append("def14a_link", def14a_link);
      fd.append("item_number", item_number);
      fd.append("voluntary_5m", voluntary_5m);
      if (exempt_agm_date) fd.append("agm_date", exempt_agm_date);
      fd.append("primary_file", primary_file);
    } else if (mode === "edit") {
      // Round-2 §7/§8: edit one of my own submitted proposals (PDF optional).
      if (!edit_id || !company_name || !registrant_cik || !proposal_topic || !meeting_date) {
        alert("Please select a proposal and fill all required (*) fields."); return;
      }
      fd.append("id", edit_id);
      fd.append("company_name", company_name);
      fd.append("registrant_cik", registrant_cik);
      fd.append("proposal_topic", proposal_topic === "Other" ? proposal_topic_other : proposal_topic);
      fd.append("proposal_text", proposal_text);
      fd.append("meeting_date", meeting_date);
      fd.append("meeting_date_known", meeting_date_known);
      fd.append("proxy_status", proxy_status);
      if (primary_file) fd.append("primary_file", primary_file);
    } else if (mode === "standalone") {
      if (!def14a_link || !std_company || !std_topic || !primary_file) {
        alert("Please fill all required (*) fields and upload the proxy memo PDF."); return;
      }
      fd.append("def14a_link", def14a_link.startsWith("http") ? def14a_link : "https://" + def14a_link);
      fd.append("company_name", std_company);
      fd.append("subject", std_topic);
      fd.append("item_number", item_number);
      fd.append("contact_name", std_contact);
      fd.append("voluntary_5m", std_5m_ack);
      fd.append("primary_file", primary_file);
    } else {
      alert("Please choose what you'd like to do."); return;
    }

    submitting = true;
    try {
      const endpoint = mode === "edit" ? "/api/filings/update-proposal" : "/api/filings/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-user": JSON.stringify(user) },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        if (mode === "edit") {
          // Edited proposal → styled confirmation popup (round-2 §7/§8).
          successKind = "edit";
          close();
          confirmOpen = true;
        } else if (mode === "new") {
          // Shareholder proposal → show the Proxy Preview confirmation popup.
          // The page reloads when the user dismisses it (closeConfirm).
          successKind = "proposal";
          close();
          confirmOpen = true;
        } else if (mode === "standalone") {
          // Standalone exempt solicitation → same styled confirmation popup
          // (matches the prototype) instead of a native browser alert.
          successKind = "standalone";
          close();
          confirmOpen = true;
        } else {
          // no_action / exempt attachment → inline "Live immediately" banner
          // (copy doc §6 [139-140]). Attachments publish immediately, so this is
          // NOT the pending-review popup. Keep the modal open to show the banner,
          // then reload so the fresh attachment state is reflected everywhere.
          const company = selectedProposal?.company_name || company_name || "the proposal";
          const label = mode === "no_action" ? "No-action notice" : "Exempt solicitation";
          attachNotice = `${label} attached to ${company}. Live immediately — no admin approval required.`;
          try { document.querySelector(".submit-modal .modal-body")?.scrollTo(0, 0); } catch {}
          setTimeout(() => { window.location.reload(); }, 2800);
        }
      } else {
        alert("Error: " + (data.message || "could not submit"));
      }
    } catch (e) {
      alert("Something went wrong.");
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key !== "Escape") return; if (confirmOpen) closeConfirm(); else if (open) close(); }} />

{#if open}
  <div class="modal-overlay active" onclick={close} role="presentation">
    <div class="modal submit-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>{titles[mode]}</h3>
        <button class="modal-close" onclick={close} aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        {#if attachNotice}
          <div class="attach-notice" role="status">
            <span class="an-check">✓</span>
            <span>{attachNotice}</span>
          </div>
        {/if}
        <!-- WELCOME NOTICE (V2) -->
        <div class="welcome-notice">
          Welcome to the Proxy Open Exchange. POE is an open, community-driven platform.
          Publish a shareholder proposal; attach a no-action notice and/or exempt
          solicitation as the season unfolds. New proposals are reviewed before
          publication; attachments to proposals publish immediately.
        </div>
        <!-- SUBMISSION MODE -->
        <div class="form-section">
          <div class="form-section-title">Submission Mode</div>
          <div class="form-section-body">
            <div class="form-row">
              <label>What would you like to do? <span class="req">*</span></label>
              <select bind:value={mode} onchange={onModeChange}>
                <option value="">— Select —</option>
                <option value="new">File a shareholder proposal filed this season</option>
                <option value="no_action">Attach a no-action / exclusion notice to one of my proposals</option>
                <option value="exempt">Attach an exempt solicitation to one of my proposals</option>
                <option value="edit">Edit one of my submitted proposals</option>
<!--
                  Standalone exempt solicitation removed per client (2026-11-14):
                  exempt solicitations are no longer filed alone — they attach to a proposal.
                  Kept here (and the mode === "standalone" block + submit branch below) so it
                  can be re-enabled later by uncommenting this option.
                  <option value="standalone">Submit a standalone exempt solicitation (legacy, no parent proposal)</option>
                -->

              </select>
              <div class="helper">Tip: you can also open any of your proposals from the filing index and attach documents directly from its detail page.</div>
            </div>
          </div>
        </div>

        <!-- ══════ EDIT: pick which submitted proposal to edit (round-2 §7/§8) ══════ -->
        {#if mode === "edit"}
          <div class="form-section">
            <div class="form-section-title">Select a Proposal to Edit</div>
            <div class="form-section-body">
              <div class="form-row">
                <label>Your Submitted Proposals <span class="req">*</span></label>
                <div class="proposal-selector">
                  <input bind:value={proposalSearch} onfocus={() => (proposalDdOpen = true)}
                         oninput={() => { edit_id = ""; proposalDdOpen = true; }}
                         placeholder="Type to search your proposals..." autocomplete="off" />
                  {#if proposalDdOpen}
                    <div class="ms-backdrop" onclick={() => (proposalDdOpen = false)} role="presentation"></div>
                    {#if myProposals.length === 0}
                      <div class="proposal-dropdown"><div class="pd-empty">You haven't submitted any proposals yet.</div></div>
                    {:else if filteredProposals.length === 0}
                      <div class="proposal-dropdown"><div class="pd-empty">No proposals match your search.</div></div>
                    {:else}
                      <div class="proposal-dropdown">
                        {#each filteredProposals as p}
                          <button type="button" class="prop-item" onclick={() => pickForEdit(p)}>
                            <strong>{p.company_name}</strong>
                            <small>{p.proposal_topic ?? "—"}{#if p.status} · {p.status}{/if}{#if p.created_at} · Filed {fmtDate(p.created_at)}{/if}</small>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </div>
                <div class="helper">Shows every proposal you've submitted (any status). Select one to load its details below, edit, and save.</div>
                {#if edit_id}
                  <p class="selected-note">✓ Editing: {proposalSearch}</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- ══════ NEW PROPOSAL / EDIT (identical form) ══════ -->
        {#if mode === "new" || (mode === "edit" && edit_id)}
          <div class="form-section">
            <div class="form-section-title">Company Information</div>
            <div class="form-section-body">
              <div class="form-grid">
                <div class="form-row">
                  <label>Company Name <span class="req">*</span></label>
                  <div class="proposal-selector">
                    <input
                      bind:value={company_name}
                      oninput={() => { showCompanyDd = true; registrant_cik = ""; lookupEdgar(company_name); }}
                      onfocus={() => (showCompanyDd = true)}
                      onblur={() => setTimeout(() => (showCompanyDd = false), 180)}
                      placeholder="Start typing a company name..."
                      autocomplete="off"
                    />
                    {#if showCompanyDd && (companyResults.length || edgarResults.length)}
                      <div class="proposal-dropdown">
                        {#each companyResults as c (c.company_name + "|" + c.company_cik)}
                          <button
                            type="button"
                            class="prop-item"
                            onmousedown={(e) => { e.preventDefault(); pickCompany(c); }}
                            onclick={() => pickCompany(c)}
                          >
                            <strong>{c.company_name}</strong>
                            <small>{#if c.company_cik}CIK {c.company_cik}{:else}On POE · add CIK{/if}{#if c.meeting_date} · last mtg {fmtDate(c.meeting_date)}{/if}</small>
                          </button>
                        {/each}
                        {#if edgarResults.length}
                          <div class="prop-divider">From SEC EDGAR — not yet on POE</div>
                          {#each edgarResults as c (c.company_cik + "|" + c.company_name)}
                            <button
                              type="button"
                              class="prop-item"
                              onmousedown={(e) => { e.preventDefault(); pickEdgar(c); }}
                              onclick={() => pickEdgar(c)}
                            >
                              <strong>{c.company_name}</strong>
                              <small>CIK {c.company_cik}{#if c.ticker} · {c.ticker}{/if} · EDGAR</small>
                            </button>
                          {/each}
                        {/if}
                      </div>
                    {/if}
                  </div>
                  <div class="helper">Companies already on POE (from any filer) appear as you type. Selecting one fills in the CIK and suggests next year's meeting date (Estimated). Not listed? Type the full name and look up the CIK on <a href="https://www.sec.gov/search-filings/cik-lookup" target="_blank" rel="noreferrer">EDGAR</a>.</div>
                </div>
                <div class="form-row">
                  <label>Registrant CIK <span class="req">*</span></label>
                  <input bind:value={registrant_cik} placeholder="10-digit CIK" />
                  <div class="helper">Don't have a CIK? <a href="https://www.sec.gov/submit-filings/filer-support-resources/how-do-i-guides/filer-id-cik" target="_blank" rel="noreferrer">Sign up for a CIK number →</a></div>
                </div>
              </div>
              <div class="form-grid">
                <div class="form-row">
                  <label>Proposal Topic <span class="req">*</span></label>
                  <select bind:value={proposal_topic}>
                    <option value="">— Select —</option>
                    {#each TOPICS as t}<option value={t}>{t}</option>{/each}
                  </select>
                  {#if proposal_topic === "Other"}
                    <input style="margin-top:10px" bind:value={proposal_topic_other} placeholder="Describe the topic" />
                  {/if}
                </div>
                <div class="form-row">
                  <label>Annual Meeting Date</label>
                  {@render dateField(meetingDateInput, meeting_date,
                    (v) => { meetingDateInput = formatMdy(v); meeting_date = mdyToIso(meetingDateInput); },
                    (iso) => { meeting_date = iso; meetingDateInput = isoToMdy(iso); })}
                  <div class="date-kind">
                    <label><input type="radio" value={false} bind:group={meeting_date_known} /> Estimated</label>
                    <label><input type="radio" value={true} bind:group={meeting_date_known} /> Known (confirmed)</label>
                  </div>
                  <div class="helper">If the date is not yet announced, estimate it using the same day and month as last year's meeting. You can switch it to Known later from your proposal's detail page.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">Proposal Details</div>
            <div class="form-section-body">
              <div class="form-row">
                <label>Proposal / Resolution Text <span class="optional">(Optional)</span></label>
                <textarea rows="5" bind:value={proposal_text} placeholder="Resolved: Shareholders request that the company..."></textarea>
                <div class="helper">Entering the full "Resolved:" clause can help your proposal appear in search engines like Google, making it easier for investors and researchers to find.</div>
              </div>

              <div class="form-row">
                <label>Included on Proxy? <span class="optional">(Optional)</span></label>
                <select bind:value={proxy_status}>
                  <option value="">— Not yet known —</option>
                  <option value="included">Included</option>
                  <option value="excluded">Excluded</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              <div class="form-row">
                <label>Supporting Document {#if mode === "edit"}<span class="optional">(PDF, optional)</span>{:else}<span class="req">*</span>{/if}</label>
                <label class="file-upload-zone {primary_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{primary_file ? primary_file.name : (mode === "edit" ? "Upload a new PDF to replace the current one" : "Click or drag to upload the full resolution (PDF)")}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (primary_file = e.target.files[0])} />
                </label>
                <div class="helper">{#if mode === "edit"}Leave empty to keep the PDF already on file. Uploading a new one replaces it.{:else}Upload the complete shareholder resolution document. This is the primary filing record on POE.{/if}</div>
              </div>
            </div>
          </div>
        {/if}

        <!-- ══════ NO-ACTION ══════ -->
        {#if mode === "no_action"}
          {@render linkToProposal()}
          <div class="form-section">
            <div class="form-section-title">No-Action / Exclusion Details</div>
            <div class="form-section-body">
              <div class="form-grid">
                <div class="form-row">
                  <label>Exclusion Basis <span class="req">*</span> <span class="optional">(select all that apply)</span></label>
                  <div class="multiselect">
                    <button type="button" class="ms-trigger" onclick={() => (basisDdOpen = !basisDdOpen)}>
                      <span class="ms-value {exclusion_bases.length ? '' : 'ms-placeholder'}">
                        {exclusion_bases.length ? `${exclusion_bases.length} selected` : "— Select —"}
                      </span>
                      <span class="ms-caret">▾</span>
                    </button>
                    {#if basisDdOpen}
                      <div class="ms-backdrop" onclick={() => (basisDdOpen = false)} role="presentation"></div>
                      <div class="ms-panel">
                        {#each EXCLUSION_BASES as b}
                          <label class="ms-option">
                            <input type="checkbox" checked={exclusion_bases.includes(b)} onchange={() => toggleBasis(b)} />
                            <span>{#if b.includes(" — ")}<strong>{b.split(" — ")[0]}</strong> — {b.split(" — ").slice(1).join(" — ")}{:else}<strong>{b}</strong>{/if}</span>
                          </label>
                        {/each}
                      </div>
                    {/if}
                    {#if exclusion_bases.length}
                      <div class="ms-chips">
                        {#each exclusion_bases as b}
                          <span class="ms-chip">{b.includes(" — ") ? b.split(" — ")[0] : b}<button type="button" onclick={() => toggleBasis(b)} aria-label="Remove">×</button></span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="form-row">
                  <label>No-Action Notice Date <span class="optional">(optional)</span></label>
                  {@render dateField(noticeDateInput, notice_date,
                    (v) => { noticeDateInput = formatMdy(v); notice_date = mdyToIso(noticeDateInput); },
                    (iso) => { notice_date = iso; noticeDateInput = isoToMdy(iso); })}
                </div>
              </div>

              <div class="form-row">
                <label>Company's Exclusion Letter <span class="optional">(PDF, optional)</span></label>
                <label class="file-upload-zone {primary_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{primary_file ? primary_file.name : "Upload the company's exclusion letter"}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (primary_file = e.target.files[0])} />
                </label>
              </div>

              <div class="form-row">
                <label>Proponent's Response <span class="optional">(PDF, optional)</span></label>
                <label class="file-upload-zone {second_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{second_file ? second_file.name : "Upload the proponent's response document"}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (second_file = e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        {/if}

        <!-- ══════ EXEMPT SOLICITATION (attach) ══════ -->
        {#if mode === "exempt"}
          {@render linkToProposal()}
          <div class="form-section">
            <div class="form-section-title">Exempt Solicitation Details</div>
            <div class="form-section-body">
              <div class="form-grid">
                <div class="form-row">
                  <label>DEF 14A Link</label>
                  <input bind:value={def14a_link} placeholder="https://www.sec.gov/..." />
                </div>
                <div class="form-row">
                  <label>Item Number <span class="optional">(optional)</span></label>
                  <input bind:value={item_number} placeholder="e.g., Item 4" />
                </div>
              </div>

              <div class="form-grid">
                <div class="form-row">
                  <label>Annual Meeting Date</label>
                  {@render dateField(exemptAgmInput, exempt_agm_date,
                    (v) => { exemptAgmInput = formatMdy(v); exempt_agm_date = mdyToIso(exemptAgmInput); },
                    (iso) => { exempt_agm_date = iso; exemptAgmInput = isoToMdy(iso); })}
                </div>
                <div></div>
              </div>

              <div class="form-row">
                <label>Voluntary $5M Ownership Checkbox <span class="req">*</span></label>
                <label class="checkbox-row">
                  <input type="checkbox" bind:checked={voluntary_5m} />
                  <span>I certify that I beneficially own more than $5 million of the issuer's securities, OR I am filing this exempt solicitation voluntarily.</span>
                </label>
              </div>

              <div class="form-row">
                <label>Exempt Solicitation / Proxy Memo (PDF) <span class="req">*</span></label>
                <label class="file-upload-zone {primary_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{primary_file ? primary_file.name : "Upload your exempt solicitation document"}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (primary_file = e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        {/if}

        <!-- ══════ STANDALONE (legacy, 4th) ══════ -->
        {#if mode === "standalone"}
          <div class="form-section">
            <div class="form-section-title">Exempt Solicitation Details (standalone)</div>
            <div class="form-section-body">
              <div class="form-row">
                <label>Company Proxy Statement Link (DEF 14A) <span class="req">*</span></label>
                <input bind:value={def14a_link} placeholder="SEC filing link" />
              </div>
              <div class="form-row">
                <label>Company Name <span class="req">*</span></label>
                <input bind:value={std_company} placeholder="Enter Company Name" />
              </div>
              <div class="form-row">
                <label>Item Number</label>
                <input bind:value={item_number} placeholder="Optional item number" />
              </div>
              <div class="form-row">
                <label>Proposal Topic <span class="req">*</span></label>
                <input bind:value={std_topic} placeholder="circular economy, climate change, social justice…" />
              </div>
              <div class="form-row">
                <label>Submission Contact Name</label>
                <input bind:value={std_contact} placeholder="Optional override" />
              </div>
              <div class="form-row">
                <label>Upload Proxy Memo PDF <span class="req">*</span></label>
                <label class="file-upload-zone {primary_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{primary_file ? primary_file.name : "Upload the proxy memo (PDF)"}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (primary_file = e.target.files[0])} />
                </label>
              </div>
              <label class="checkbox-row">
                <input type="checkbox" bind:checked={std_5m_ack} />
                <span>I understand that if I beneficially own securities with a value exceeding $5 million, or am otherwise subject to reporting obligations under applicable U.S. securities laws, any submission or activity on this platform (POE) does not satisfy or replace any required filings with the U.S. Securities and Exchange Commission ("SEC"), and I remain solely responsible for complying with all such obligations.</span>
              </label>
            </div>
          </div>
        {/if}

        <!-- FILER INFO (shown for proposal + attach modes) -->
        {#if mode === "new" || mode === "no_action" || mode === "exempt" || (mode === "edit" && edit_id)}
          <div class="form-section">
            <div class="form-section-title">Filer Information <span class="auto">· Auto-populated from your account</span></div>
            <div class="form-section-body">
              <div class="form-grid">
                <div class="form-row">
                  <label>Filer / Proponent Name</label>
                  <input value={user?.org_name ?? ""} readonly />
                </div>
                <div class="form-row">
                  <label>Filer CIK</label>
                  <input value={user?.cik ?? ""} readonly />
                </div>
              </div>
              <div class="form-grid">
                <div class="form-row">
                  <label>Contact Name</label>
                  <input value={user?.contact_name ?? ""} readonly />
                </div>
                <div class="form-row">
                  <label>Contact Email</label>
                  <input value={user?.email ?? ""} readonly />
                </div>
              </div>
              <div class="helper account-note">This information is pulled from your POE account registration. To update, visit your <a href="/dashboard">account settings</a>.</div>
            </div>
          </div>
        {/if}

        <!-- CERTIFICATION (only once a mode is chosen / proposal picked) -->
        {#if mode && (mode !== "edit" || edit_id)}
          <div class="form-section">
            <div class="form-section-title">Certification</div>
            <div class="form-section-body">
              <label class="checkbox-row">
                <input type="checkbox" bind:checked={certify} />
                <span>I certify that the information provided is accurate, that I have authority to file on behalf of the named entity, and I authorize this submission to be published on the Proxy Open Exchange. I have read and acknowledged the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a>.</span>
              </label>
              {#if mode === "new"}
                <label class="checkbox-row" style="margin-top:12px;">
                  <input type="checkbox" bind:checked={proxyPreviewInterest} />
                  <span>I am interested in submitting an article to be possibly included in <strong>Proxy Preview 2027</strong>.</span>
                </label>
              {/if}
            </div>
          </div>
        {/if}

        <!-- ACTIONS (only once a submission mode is chosen) -->
        {#if mode}
          <div class="form-actions">
            <button class="btn-cancel" onclick={close}>Cancel</button>
            <button class="btn-primary" onclick={submitFiling} disabled={submitting || (mode === "edit" && !edit_id)}>
              {submitting ? (mode === "edit" ? "Saving…" : "Submitting…") : (mode === "edit" ? "Save Changes" : "Submit Filing")}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Submission confirmation popup — matches the prototype's .confirm-card -->
{#if confirmOpen}
  <div class="confirm-popup show" onclick={closeConfirm} role="presentation">
    <div class="confirm-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="check-icon">✓</div>
      <h3>{successHeadline}</h3>
      <div class="confirm-msg">
        <!-- Scope §4: no-action & exempt reuse the SAME popup body as the proposal
             success popup — only the headline changes per type. -->
        {#if successKind === "standalone"}
          <p>Your <strong>exempt solicitation has been submitted</strong> and is pending admin review.</p>
        {:else}
          <p><strong>Your shareholder proposal has been submitted</strong> and is pending admin review.</p>
          <p class="cm-line"><span class="cm-dot">●</span> <strong>Be sure to return to update your resolution</strong> once you know if it has been included in the issuer's proxy statement, excluded, or withdrawn.</p>
          <p class="cm-line"><span class="cm-dot">●</span> If you have an interest in submitting an article to be included in <strong>Proxy Preview 2027</strong> please review the
            {#if PROXY_PREVIEW_URL}<a href={PROXY_PREVIEW_URL} target="_blank" rel="noopener noreferrer">contribution instructions</a>.{:else}contribution instructions <span class="cm-soon">(link coming soon)</span>.{/if}
          </p>
        {/if}
      </div>
      <button class="btn-primary confirm-done" onclick={closeConfirm}>Done</button>
    </div>
  </div>
{/if}

{#snippet dateField(displayValue, isoValue, setFromText, setFromNative)}
  <div class="date-field">
    <input type="text" inputmode="numeric" placeholder="mm/dd/yyyy" maxlength="10"
           value={displayValue} oninput={(e) => setFromText(e.target.value)} />
    <input type="date" class="date-native" tabindex="-1" aria-hidden="true"
           value={isoValue} onchange={(e) => setFromNative(e.target.value)} />
    <button type="button" class="date-btn" onclick={openDatePicker} aria-label="Open calendar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    </button>
  </div>
{/snippet}

{#snippet linkToProposal()}
  <div class="form-section">
    <div class="form-section-title">Link to Proposal</div>
    <div class="form-section-body">
      <div class="form-row">
        <label>Select Your Proposal <span class="req">*</span></label>
        <div class="proposal-selector">
          <input bind:value={proposalSearch} onfocus={() => (proposalDdOpen = true)}
                 oninput={() => { parent_proposal_id = ""; proposalDdOpen = true; }}
                 placeholder="Type to search your proposals..." autocomplete="off" />
          {#if proposalDdOpen}
            <div class="ms-backdrop" onclick={() => (proposalDdOpen = false)} role="presentation"></div>
            {#if myProposals.length === 0}
              <div class="proposal-dropdown"><div class="pd-empty">No approved proposals found on your account yet.</div></div>
            {:else if filteredProposals.length === 0}
              <div class="proposal-dropdown"><div class="pd-empty">No proposals match your search.</div></div>
            {:else}
              <div class="proposal-dropdown">
                {#each filteredProposals as p}
                  <button type="button" class="prop-item" onclick={() => pickProposal(p)}>
                    <strong>{p.company_name}</strong>
                    <small>{p.proposal_topic ?? "—"}{#if p.created_at} · Filed {fmtDate(p.created_at)}{/if}</small>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
        <div class="helper">Only shows your own proposals. Search by company name or topic.</div>
        {#if parent_proposal_id}
          <p class="selected-note">✓ Selected: {proposalSearch}</p>
        {/if}
      </div>

      {#if selectedProposal}
        <div class="form-grid">
          <div class="form-row">
            <label>Company Name</label>
            <div class="inherited-field">{selectedProposal.company_name ?? "—"}</div>
          </div>
          <div class="form-row">
            <label>Registrant CIK</label>
            <div class="inherited-field">{selectedProposal.company_cik ?? "—"}</div>
          </div>
        </div>
        <div class="form-row">
          <label>Proposal Topic</label>
          <div class="inherited-field">{selectedProposal.proposal_topic ?? "—"}</div>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<style>
  /* The submit modal follows the prototype at 820px (inline override in the artifact); shell + form skeleton
     (.modal-overlay/.modal/.modal-header/.form-section/.form-row/.form-grid/
     .btn-cancel/.btn-primary/.file-upload-zone/.checkbox-row/.date-kind/
     .proposal-selector/.proposal-dropdown/.inherited-field) come from app.css
     so they match the design system exactly. Only the extras live here. */
  .submit-modal { max-width: 820px; }
  /* No divider line above the footer buttons (client preference) */
  .submit-modal .form-actions { border-top: none; padding-top: 0; }

  .form-section-title .auto {
    text-transform: none; letter-spacing: 0; color: var(--g4); font-weight: 400;
  }

  .req { color: var(--accent); }
  /* "(Optional)" sits inside the uppercase mono field label — inherit case/spacing like the prototype, just lighter */
  .optional { color: var(--g4); font-weight: 400; }
  .helper.muted { color: var(--accent); }
  /* Filer-info note sits outside a .form-row, so give it the same 12px helper look */
  .account-note { font-size: 12px; color: var(--g3); line-height: 1.5; margin-top: 4px; }
  .account-note a { color: var(--blue-light); text-decoration: underline; font-weight: 600; }
  .selected-note { color: var(--green); font-size: 12.5px; font-weight: 600; margin: 8px 0 0; font-family: var(--sans); }

  /* readonly / inherited inputs */
  input[readonly] { background: var(--paper-warm); color: var(--g5); }
  input[readonly]:focus { box-shadow: none; border-color: var(--g2); }


  /* no-action exclusion-basis — multi-select dropdown (looks like a select, picks many) */
  .multiselect { position: relative; }
  .ms-trigger {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-family: var(--sans); font-size: 14px; padding: 10px 14px;
    border: 1.5px solid var(--g2); border-radius: 4px; background: #fff; color: var(--ink);
    cursor: pointer; text-align: left;
  }
  .ms-trigger:hover { border-color: var(--blue-light); }
  .ms-placeholder { color: var(--g3); }
  .ms-caret { color: var(--g4); font-size: 12px; flex: 0 0 auto; }
  .ms-backdrop { position: fixed; inset: 0; z-index: 40; }
  /* mm/dd/yyyy text field + calendar-picker button */
  .date-field { position: relative; display: block; }
  .date-field > input[type="text"] { width: 100%; padding-right: 42px; }
  /* Tiny anchor on the LEFT edge so the native picker drops down INSIDE the modal
     (anchoring it to the right edge made the picker spill outside the popup). */
  .date-field .date-native {
    position: absolute; left: 10px; bottom: 4px; width: 1px; height: 1px;
    opacity: 0; border: 0; padding: 0; margin: 0; pointer-events: none;
  }
  .date-field .date-btn {
    position: absolute; right: 1px; top: 1px; bottom: 1px; width: 36px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; border-left: 1px solid var(--g1);
    color: var(--g4); cursor: pointer; border-radius: 0 4px 4px 0;
  }
  .date-field .date-btn:hover { color: var(--blue); background: var(--paper-warm); }
  /* lift the search dropdown above the click-away backdrop so its items stay clickable */
  .proposal-selector .proposal-dropdown { z-index: 50; }
  .pd-empty { padding: 12px 14px; font-size: 13px; color: var(--g4); font-family: var(--sans); }
  .ms-panel {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
    background: #fff; border: 1.5px solid var(--blue-light); border-radius: 4px;
    box-shadow: var(--shadow-lg); max-height: 260px; overflow-y: auto; padding: 4px;
  }
  .ms-option {
    display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border-radius: 3px;
    font-family: var(--sans); font-size: 13px; line-height: 1.4; color: var(--g5);
    text-transform: none; letter-spacing: 0; font-weight: 400; margin: 0; cursor: pointer;
  }
  .ms-option:hover { background: var(--paper); }
  .ms-option input[type="checkbox"] { margin-top: 2px; accent-color: var(--blue); width: 15px; height: 15px; flex: 0 0 auto; }
  .ms-option strong { color: var(--blue); font-weight: 700; }
  .ms-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .ms-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: #e8f0fe; color: var(--blue); font-family: var(--mono); font-size: 11px; font-weight: 600;
    padding: 3px 6px 3px 9px; border-radius: 3px;
  }
  .ms-chip button { background: none; border: none; color: var(--blue); cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
  .ms-chip button:hover { color: var(--accent); }

  /* inline attach-success banner */
  .welcome-notice {
    background: var(--paper, #faf8f3);
    border-left: 3px solid var(--gold, #c9a84c);
    border-radius: 4px;
    padding: 12px 16px;
    margin-bottom: 18px;
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.55;
    color: var(--g5, #4a4a4a);
  }
  .confirm-card .confirm-msg .cm-soon { color: var(--g4, #8a8a8a); font-style: italic; }

  .attach-notice {
    display: flex; align-items: center; gap: 10px;
    background: var(--green-light); border: 1px solid #b7e0c4; color: var(--green);
    border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; line-height: 1.4;
  }
  .attach-notice .an-check {
    flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%;
    background: var(--green); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px;
  }

  /* Submission confirmation popup — matches the prototype's .confirm-popup/.confirm-card */
  .confirm-popup {
    position: fixed; inset: 0; background: rgba(10, 14, 23, 0.6);
    display: none; align-items: center; justify-content: center; z-index: 1100; padding: 20px;
  }
  .confirm-popup.show { display: flex; }
  .confirm-card {
    background: #fff; border-radius: 8px; max-width: 520px; width: 100%;
    box-shadow: var(--shadow-lg); padding: 32px; text-align: center;
  }
  .confirm-card .check-icon { font-size: 48px; color: var(--green); margin-bottom: 12px; line-height: 1; }
  .confirm-card h3 { font-family: var(--serif); font-size: 22px; color: var(--blue); margin-bottom: 16px; }
  .confirm-card .confirm-msg {
    font-size: 14px; color: var(--g5); line-height: 1.7; margin-bottom: 12px; text-align: left;
    background: var(--paper-warm); padding: 16px; border-radius: 6px; border-left: 4px solid var(--gold);
    font-family: var(--sans);
  }
  .confirm-card .confirm-msg p { margin: 0; }
  .confirm-card .confirm-msg .cm-line { margin-top: 12px; }
  .confirm-card .confirm-msg .cm-dot { color: var(--g5); }
  .confirm-card .confirm-msg strong { color: var(--blue); }
  .confirm-card .confirm-msg a, .cf-link-soon { color: var(--blue-light); text-decoration: underline; font-weight: 600; }
  .cf-soon { color: var(--g3); font-style: italic; font-size: 12px; }
  .confirm-card .confirm-done { margin-top: 16px; }
</style>
