<script>
  import { onMount } from "svelte";
  import { EXCLUSION_BASES, parseBases } from "$lib/exclusionBases.js";
  import { fmtDate, cleanFileName } from "$lib/formatDate.js";
  import { TOPICS } from "$lib/topics.js";

  // The old "+ Submit Exempt Solicitation" pill is hidden for now (A1): it pointed
  // at the legacy exempt-only submission. Awaiting client approval on the new flow.

  let editMode = $state(false);
  let filings = $state([]);
  let filtered = $state([]);
  let activeTab = $state("pending");

  let stats = $state({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  onMount(async () => {
    const admin = localStorage.getItem("admin");
    if (!admin) window.location.href = "/admin/login";

    const res = await fetch("/api/admin/filings");
    filings = await res.json();

    updateUI();
  });

  function updateUI() {
    const visible = filings.filter((f) => f.status !== "deleted");

    stats = {
      pending: visible.filter((f) => (f.status || "pending") === "pending")
        .length,
      approved: visible.filter((f) => f.status === "approved").length,
      rejected: visible.filter((f) => f.status === "rejected").length,
      total: visible.length,
    };

    applyFilter();
  }

  function applyFilter() {
    const visible = filings.filter((f) => f.status !== "deleted");

    let rows =
      activeTab === "all"
        ? [...visible]
        : visible.filter((f) => (f.status || "pending") === activeTab);

    // attachment filter (proposal rows only for the "without" cases)
    if (attachFilter === "has_na") rows = rows.filter((f) => f.has_no_action);
    else if (attachFilter === "no_na")
      rows = rows.filter((f) => f.filing_type === "proposal" && !f.has_no_action);
    else if (attachFilter === "has_es") rows = rows.filter((f) => f.has_exempt_solicitation);
    else if (attachFilter === "no_es")
      rows = rows.filter((f) => f.filing_type === "proposal" && !f.has_exempt_solicitation);

    // keyword search (company, filer, topic, CIK, proposal text, exclusion basis)
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (f) =>
          (f.company_name || f.memo_submitter || "").toLowerCase().includes(term) ||
          (f.filer_name || "").toLowerCase().includes(term) ||
          (f.proposal_topic || f.subject || "").toLowerCase().includes(term) ||
          (f.company_cik || "").includes(term) ||
          (f.filer_cik || "").includes(term) ||
          (f.proposal_text || "").toLowerCase().includes(term) ||
          (f.exclusion_basis || "").toLowerCase().includes(term),
      );
    }

    filtered = rows;
    currentPage = 1; // any tab/filter/search change returns to the first page
  }
  function setTab(tab) {
    activeTab = tab;
    applyFilter();
  }

  let showModal = $state(false);
  let selectedFiling = $state(null);
  let adminNote = $state("");
  let materialTab = $state("proposal");

  // ── point 3: attachment filter (applies to the current tab's rows) ──
  let attachFilter = $state("all"); // all | has_na | no_na | has_es | no_es
  function setAttachFilter(v) {
    attachFilter = v;
    applyFilter();
  }

  // ── search + pagination ──
  let search = $state("");
  let currentPage = $state(1);
  const pageSize = 15;
  let pagedRows = $derived(
    filtered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize),
  );
  let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));

  // ── point 2: vote-results inputs (prefilled per proposal) ──
  let vf = $state("");
  let vag = $state("");
  let vab = $state("");
  // live total for the vote-results readout + progress bar
  let voteTotal = $derived(
    (parseFloat(vf) || 0) + (parseFloat(vag) || 0) + (parseFloat(vab) || 0),
  );

  // ── point 1: admin attach-to-any-proposal ──
  let attaching = $state(null); // null | 'no_action' | 'exempt'
  let attachBusy = $state(false);
  let naBases = $state([]);
  let naNotice = $state("");
  let naLetterFile = $state(null);
  let naResponseFile = $state(null);
  let esLink = $state("");
  let esItem = $state("");
  let esVol = $state(false);
  let esFile = $state(null);

  function toggleNaBasis(b) {
    naBases = naBases.includes(b) ? naBases.filter((x) => x !== b) : [...naBases, b];
  }

  const resolveProposal = (f) =>
    f.filing_type === "proposal" ? f : filings.find((x) => x.id === f.proposal_id) || f;

  function openReview(filing) {
    selectedFiling = filing;
    materialTab =
      filing.filing_type === "no_action"
        ? "no_action"
        : filing.filing_type === "exempt_solicitation" && filing.proposal_id
          ? "exempt"
          : "proposal";
    // prefill vote-results from the parent proposal; reset the attach form
    const p = resolveProposal(filing);
    vf = p.vote_for ?? "";
    vag = p.vote_against ?? "";
    vab = p.vote_abstain ?? "";
    attaching = null;
    editMode = false;
    showModal = true;
  }

  // ── Admin inline edit of submission fields (v1.0 parity) ──
  let originalFiling = null; // snapshot for Cancel
  function startEdit() {
    originalFiling = { ...selectedFiling };
    editMode = true;
    loadEditCompanies();
  }
  function cancelEdit() {
    if (originalFiling) selectedFiling = { ...originalFiling };
    editMode = false;
    editCompanyDd = false;
  }

  // Company typeahead for the proposal edit — same behaviour as the filing form
  // (type → pick an existing company → CIK auto-fills).
  let editCompanies = $state([]);
  let editCompanyDd = $state(false);
  const normName = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  async function loadEditCompanies() {
    if (editCompanies.length) return;
    try { const r = await fetch("/api/filings/companies"); editCompanies = r.ok ? await r.json() : []; }
    catch { editCompanies = []; }
  }
  const editCompanyResults = $derived(
    selectedFiling && (selectedFiling.company_name || "").trim().length >= 2
      ? editCompanies.filter((c) => normName(c.company_name).includes(normName(selectedFiling.company_name))).slice(0, 8)
      : []
  );
  function pickEditCompany(c) {
    selectedFiling.company_name = c.company_name;
    selectedFiling.company_cik = c.company_cik || "";
    editCompanyDd = false;
  }

  async function saveVotes(proposalId) {
    const res = await fetch("/api/admin/vote-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, vote_for: vf, vote_against: vag, vote_abstain: vab }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Save failed");
      return;
    }
    filings = filings.map((f) =>
      f.id === proposalId
        ? { ...f, vote_for: data.vote_for, vote_against: data.vote_against, vote_abstain: data.vote_abstain }
        : f,
    );
    updateUI();
    alert("Vote results saved.");
  }

  function startAttach(kind) {
    attaching = kind;
    naBases = []; naNotice = ""; naLetterFile = null; naResponseFile = null;
    esLink = ""; esItem = ""; esVol = false; esFile = null;
  }

  async function submitAttach(proposalId) {
    const fd = new FormData();
    fd.append("proposal_id", proposalId);
    fd.append("mode", attaching);

    if (attaching === "no_action") {
      if (naBases.length === 0) return alert("Select at least one exclusion basis.");
      fd.append("exclusion_basis", JSON.stringify(naBases));
      if (naNotice) fd.append("notice_date", naNotice);
      if (naLetterFile) fd.append("company_letter_file", naLetterFile);
      if (naResponseFile) fd.append("response_file", naResponseFile);
    } else {
      if (!esFile) return alert("Exempt solicitation PDF is required.");
      fd.append("def14a_link", esLink);
      fd.append("item_number", esItem);
      fd.append("voluntary_5m", esVol ? "true" : "false");
      fd.append("primary_file", esFile);
    }

    attachBusy = true;
    const res = await fetch("/api/admin/attach", { method: "POST", body: fd });
    const data = await res.json();
    attachBusy = false;
    if (!res.ok) {
      alert(data.message || "Attach failed");
      return;
    }
    attaching = null;
    const fresh = await fetch("/api/admin/filings");
    filings = await fresh.json();
    updateUI();
    alert("Attached — live immediately, no approval needed.");
  }

  function closeModal() {
    showModal = false;
    selectedFiling = null;
    adminNote = "";
    editMode = false;
  }
  async function deleteFiling(id) {
    const confirmDelete = confirm("Are you sure?");
    if (!confirmDelete) return;

    // just update status (NOT delete API)
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: "deleted",
      }),
    });

    // update UI
    filings = filings.map((f) =>
      f.id === id ? { ...f, status: "deleted" } : f,
    );

    updateUI();
  }
  async function updateStatus(id, status) {
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status,
        note: adminNote, // 🔥 important
      }),
    });

    async function deleteFiling(id) {
      await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      filings = filings.filter((f) => f.id !== id);

      updateUI();
    }

    filings = filings.map((f) =>
      f.id === id ? { ...f, status, admin_note: adminNote } : f,
    );

    updateUI();
    closeModal();
  }

  async function removeAttachment(childId, kind) {
    const label = kind === "no_action" ? "no-action/exclusion" : "exempt solicitation";
    if (!confirm(`Remove this ${label} document? The proposal itself will not be deleted.`))
      return;

    const res = await fetch("/api/admin/remove-attachment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: childId }),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Remove failed");
      return;
    }

    // re-pull so flags, lifecycle and tabs reflect the removal truthfully
    const fresh = await fetch("/api/admin/filings");
    filings = await fresh.json();
    updateUI();
  }

  async function saveEdit() {
    const res = await fetch("/api/admin/update-filing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(selectedFiling),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Updated successfully");

      filings = filings.map((f) =>
        f.id === selectedFiling.id ? selectedFiling : f,
      );

      editMode = false;

      updateUI();
    } else {
      alert(data.message || "Update failed");
    }
  }
</script>

<svelte:head>
  <title>POE | Admin Dashboard</title>
</svelte:head>

<svelte:window on:keydown={(e) => { if (e.key === "Escape" && showModal) closeModal(); }} />

<div class="container">
  <div class="header"></div>
  <h2 class="title">Filing Administration</h2>

  <!-- STATS -->
  <div class="stats">
    <div class="stat-card">
      <div class="num pending">{stats.pending}</div>
      <div class="label">PENDING</div>
    </div>

    <div class="stat-card">
      <div class="num approved">{stats.approved}</div>
      <div class="label">APPROVED</div>
    </div>

    <div class="stat-card">
      <div class="num rejected">{stats.rejected}</div>
      <div class="label">REJECTED</div>
    </div>

    <div class="stat-card">
      <div class="num total">{stats.total}</div>
      <div class="label">TOTAL</div>
    </div>
  </div>

  <!-- TABS -->
  <div class="tabs">
    <div
      class:active={activeTab === "pending"}
      on:click={() => setTab("pending")}
    >
      PENDING REVIEW
      {#if stats.pending > 0}
        <span class="badge">{stats.pending}</span>
      {/if}
    </div>

    <div
      class:active={activeTab === "approved"}
      on:click={() => setTab("approved")}
    >
      APPROVED
    </div>

    <div
      class:active={activeTab === "rejected"}
      on:click={() => setTab("rejected")}
    >
      REJECTED
    </div>

    <div class:active={activeTab === "all"} on:click={() => setTab("all")}>
      ALL PROPOSALS
    </div>
    <!-- A1: old exempt-only submission pill hidden pending client approval of the new flow.
    <button
      class="admin-submit-btn"
      on:click={() => (showAdminSubmit = true)}
    >
      + Submit Exempt Solicitation
    </button>
    -->

  </div>

  <!-- SEARCH + ATTACHMENT FILTER -->
  <div class="filter-bar">
    <input
      class="admin-search"
      type="search"
      bind:value={search}
      on:input={applyFilter}
      placeholder="Search company, filer, topic, CIK, exclusion basis…"
    />
    <span class="filter-label">FILTER:</span>
    <select bind:value={attachFilter} on:change={() => setAttachFilter(attachFilter)}>
      <option value="all">All proposals</option>
      <option value="has_na">Has No-Action</option>
      <option value="no_na">Without No-Action</option>
      <option value="has_es">Has Exempt Solicitation</option>
      <option value="no_es">Without Exempt Solicitation</option>
    </select>
    <span class="filter-count">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
  </div>

  <!-- TABLE -->
  <div class="table-wrap">
    <table class="filing-table">
      <thead>
        <tr>
          <th>DATE</th>
          <th>COMPANY</th>
          <th>FILER</th>
          <th>TOPIC</th>
          <th>STATUS</th>
          <th>NO-ACTION</th>
          <th>EXEMPT SOLICITATION</th>
          <th>ACTIONS</th>
        </tr>
      </thead>

      <tbody>
        {#each pagedRows as f}
          <tr>
            <td>{fmtDate(f.created_at)}</td>

            <td>
              <strong>{f.company_name || f.memo_submitter || "-"}</strong><br />
              <span class="sub">CIK: {f.company_cik || "-"}</span>
            </td>

            <td>{f.filer_name || f.memo_submitter || "-"}</td>

            <td>
              {#if f.proposal_topic || f.subject}
                <span class="topic-chip">{f.proposal_topic || f.subject}</span>
              {:else}
                <span class="sub">—</span>
              {/if}
            </td>

            <td>
              <span class="status {f.status}">{f.status}</span>
            </td>

            <td><span class="yn {f.has_no_action ? 'yes' : 'no'}">{f.has_no_action ? "Yes" : "No"}</span></td>
            <td><span class="yn {f.has_exempt_solicitation ? 'yes' : 'no'}">{f.has_exempt_solicitation ? "Yes" : "No"}</span></td>

            <td class="actions">
              <button class="icon review" title="View" aria-label="View" on:click={() => openReview(f)}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>
              </button>
              <button class="icon approve" title="Approve" aria-label="Approve" on:click={() => updateStatus(f.id, "approved")}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </button>
              <button class="icon reject" title="Reject" aria-label="Reject" on:click={() => updateStatus(f.id, "rejected")}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <button class="icon delete" title="Delete" aria-label="Delete" on:click={() => deleteFiling(f.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3v1H4v2h16V4h-5V3H9m1 4h2v10h-2V7m4 0h2v10h-2V7M6 7h2v10H6V7Z"/></svg>
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if filtered.length === 0}
    <p class="empty-row">No filings match the current tab, filter, or search.</p>
  {:else}
    <div class="admin-pagination">
      <button class="pg-btn" disabled={currentPage === 1} on:click={() => currentPage--}>← Previous</button>
      <span class="pg-text">
        Page {currentPage} / {totalPages} · showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
      </span>
      <button class="pg-btn" disabled={currentPage === totalPages} on:click={() => currentPage++}>Next →</button>
    </div>
  {/if}

  {#if showModal && selectedFiling}
    <div class="modal-overlay">
      <div class="modal">
        <!-- HEADER -->
        <div class="modal-header">
          <h3>
            {#if selectedFiling.filing_type === "exempt_solicitation" && !selectedFiling.proposal_id}
              Exempt Solicitation — {selectedFiling.subject || "-"}
            {:else}
              {selectedFiling.company_name || "-"} — Shareholder Proposal
            {/if}
          </h3>
          <button class="modal-x" on:click={closeModal} aria-label="Close">×</button>
        </div>

        <!-- BODY -->
        <div class="modal-body">
          <!-- <div class="status-tag">{selectedFiling.status}</div> -->
          <div class="status-row">
            <!-- <div class="tag">
              {selectedFiling?.accession_number?.split("-")[0]}
            </div> -->

            <span class="status {selectedFiling.status}">{selectedFiling.status}</span>
          </div>
          <!-- <h2 class="main-title">
            Proxy Memo — {selectedFiling.subject}
          </h2> -->
          {#if selectedFiling.filing_type === "exempt_solicitation" && !selectedFiling.proposal_id}
            <!-- ═══════ LEGACY STANDALONE EXEMPT (4th type — simple view) ═══════ -->
            <h2 class="main-title">Exempt Solicitation — {selectedFiling.subject || "-"}</h2>
            <p class="date">Filed {fmtDate(selectedFiling.created_at)}</p>
            <div class="section">
              <h4>PROXY INFORMATION</h4>
              <div class="grid">
                <div>Topic</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.subject} />{:else}{selectedFiling.subject || "-"}{/if}</div>
                <div>Company</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.memo_submitter} />{:else}{selectedFiling.memo_submitter || "-"}{/if}</div>
                <div>DEF 14A Filing</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.def14a_link} />{:else}{#if selectedFiling.def14a_link}<a href={selectedFiling.def14a_link} target="_blank">{selectedFiling.def14a_link}</a>{:else}-{/if}{/if}</div>
                <div>Proposal Item</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.item_number} />{:else}{selectedFiling.item_number || "-"}{/if}</div>
                <div>Organization</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.company_name} />{:else}{selectedFiling.company_name || "-"}{/if}</div>
                <div>Organization CIK</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.company_cik} />{:else}{selectedFiling.company_cik || "-"}{/if}</div>
                <div>Contact</div><div>{#if editMode}<input class="edit-input" bind:value={selectedFiling.contact_name} />{:else}{selectedFiling.contact_name || "-"} · {selectedFiling.contact_email || "-"}{/if}</div>
              </div>
            </div>
            <div class="section">
              <h4>WRITTEN MATERIALS</h4>
              {#if selectedFiling.pdf_s3_key}
                <a class="pdf-link" href={`/${selectedFiling.pdf_s3_key}`} target="_blank">📄 {cleanFileName(selectedFiling.pdf_filename)}</a>
              {:else}<p class="muted">No PDF uploaded</p>{/if}
            </div>

          {:else}
            <!-- ═══════ UNIFIED PROPOSAL VIEW (matches artifact) ═══════ -->
            {@const pv = selectedFiling.filing_type === "proposal" ? selectedFiling : (filings.find((x) => x.id === selectedFiling.proposal_id) || selectedFiling)}
            {@const es = filings.find((x) => x.proposal_id === pv.id && x.filing_type === "exempt_solicitation" && x.status !== "deleted")}
            {@const na = filings.find((x) => x.proposal_id === pv.id && x.filing_type === "no_action" && x.status !== "deleted")}

            <h2 class="main-title">{pv.company_name || "-"}</h2>
            <p class="date">Filed {fmtDate(pv.created_at)} · Filer: {pv.filer_name || "-"}</p>

            <div class="lifecycle">
              <div class="step done">
                <span class="dot"></span><span class="step-label">PROPOSAL FILED</span>
                <span class="step-sub">{fmtDate(pv.created_at)}</span>
              </div>
              <div class="step {na ? 'done' : ''}">
                <span class="dot"></span><span class="step-label">NO-ACTION</span>
                <span class="step-sub">{na ? (na.notice_date ? fmtDate(na.notice_date) : (na.status === "approved" ? "Filed" : "Pending")) : "None on record"}</span>
              </div>
              <div class="step {pv.proxy_status ? 'done' : ''}">
                <span class="dot"></span><span class="step-label">EXCLUSION</span>
                <span class="step-sub">{pv.proxy_status ? pv.proxy_status.charAt(0).toUpperCase() + pv.proxy_status.slice(1) : "Not yet known"}</span>
              </div>
              <div class="step {es ? 'done' : ''}">
                <span class="dot"></span><span class="step-label">EXEMPT SOLICITATION</span>
                <span class="step-sub">{es ? (es.status === "approved" ? "Filed" : "Pending") : "None on record"}</span>
              </div>
              <div class="step {pv.meeting_date_known ? 'done' : ''}">
                <span class="dot"></span><span class="step-label">{pv.meeting_date_known ? "AGM DATE" : "EST. AGM DATE"}</span>
                <span class="step-sub">{pv.meeting_date ? fmtDate(pv.meeting_date) : "-"}</span>
              </div>
            </div>

            <div class="two-col">
              <div>
                <h4>COMPANY</h4>
                <div class="grid">
                  <div>Company</div><div>{#if editMode}
                    <div class="company-ta">
                      <input class="edit-input" bind:value={pv.company_name} autocomplete="off"
                        on:input={() => (editCompanyDd = true)} on:focus={() => (editCompanyDd = true)}
                        on:blur={() => setTimeout(() => (editCompanyDd = false), 180)} />
                      {#if editCompanyDd && editCompanyResults.length}
                        <div class="company-ta-dd">
                          {#each editCompanyResults as c}
                            <button type="button" class="ta-item" on:mousedown={(e) => { e.preventDefault(); pickEditCompany(c); }}>
                              <strong>{c.company_name}</strong>
                              <small>{#if c.company_cik}CIK {c.company_cik}{:else}On POE · add CIK{/if}</small>
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else}{pv.company_name || "-"}{/if}</div>
                  <div>Registrant CIK</div><div>{#if editMode}<input class="edit-input" bind:value={pv.company_cik} placeholder="10-digit CIK" />{:else}{pv.company_cik || "-"}{/if}</div>
                  <div>Proposal Topic</div><div>{#if editMode}
                    <select class="edit-input" bind:value={pv.proposal_topic}>
                      {#if pv.proposal_topic && !TOPICS.includes(pv.proposal_topic)}<option value={pv.proposal_topic}>{pv.proposal_topic}</option>{/if}
                      {#each TOPICS as t}<option value={t}>{t}</option>{/each}
                    </select>
                  {:else}{#if pv.proposal_topic}<span class="topic-chip">{pv.proposal_topic}</span>{:else}-{/if}{/if}</div>
                  <div>Annual Meeting</div><div>{#if editMode}<span class="edit-meeting"><input type="date" class="edit-input" bind:value={pv.meeting_date} /><select class="edit-input" bind:value={pv.meeting_date_known}><option value={false}>Estimated</option><option value={true}>Known</option></select></span>{:else}{pv.meeting_date ? fmtDate(pv.meeting_date) : "-"} <span class="muted">{pv.meeting_date_known ? "Confirmed" : "Estimated"}</span>{/if}</div>
                  <div>Proxy Preview 2027</div><div>{#if pv.proxy_preview_interest}<span class="pp-interest">★ Interested</span>{:else}<span class="muted">Not interested</span>{/if}</div>
                </div>
              </div>
              <div>
                <h4>SUBMITTED BY</h4>
                <div class="grid">
                  <div>Filer</div><div>{pv.filer_name || "-"}</div>
                  <div>Filer CIK</div><div>{pv.filer_cik || "-"}</div>
                  <div>Contact</div><div>{pv.contact_name || "-"}</div>
                  <div>Email</div><div>{pv.contact_email || "-"}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h4 class="wm-head">Written Materials</h4>
              <div class="mat-tabs">
                <button class:active={materialTab === "proposal"} on:click={() => (materialTab = "proposal")}>PROPOSAL ✓</button>
                <button class:active={materialTab === "exempt"} on:click={() => (materialTab = "exempt")}>EXEMPT SOLICITATION {es ? "✓" : "—"}</button>
                <button class:active={materialTab === "no_action"} on:click={() => (materialTab = "no_action")}>NO-ACTION {na ? "✓" : "—"}</button>
              </div>

              {#if materialTab === "proposal"}
                <div class="mat-body">
                  {#if pv.pdf_s3_key}<a class="pdf-link" href={`/${pv.pdf_s3_key}`} target="_blank">📄 {cleanFileName(pv.pdf_filename) || "Supporting document (PDF)"}</a>{/if}
                  {#if editMode}<div class="callout"><div class="callout-label">RESOLVED CLAUSE</div><textarea class="edit-input edit-textarea" bind:value={pv.proposal_text} placeholder="Resolved: …"></textarea></div>{:else if pv.proposal_text}<div class="callout"><div class="callout-label">RESOLVED CLAUSE</div>{pv.proposal_text}</div>{:else}<p class="muted">See the full proposal PDF above.</p>{/if}
                </div>
              {:else if materialTab === "exempt"}
                <div class="mat-body">
                  {#if es}
                    <div class="grid">
                      <div>DEF 14A Link</div><div>{#if es.def14a_link}<a href={es.def14a_link} target="_blank">{es.def14a_link}</a>{:else}Not provided{/if}</div>
                      <div>Item Number</div><div>{es.item_number || "-"}</div>
                      <div>Form Type</div><div>PX14A6G — Notice of Exempt Solicitation</div>
                      <div>Status</div><div>{es.status}</div>
                    </div>
                    {#if es.pdf_s3_key}<a class="pdf-link" href={`/${es.pdf_s3_key}`} target="_blank">📄 {cleanFileName(es.pdf_filename)}</a>{/if}
                    <div class="remove-row">
                      <button class="remove-doc" on:click={() => removeAttachment(es.id, "exempt")}>
                        ✕ Remove exempt solicitation
                      </button>
                    </div>
                  {:else}
                    <p class="muted">No exempt solicitation on record</p>
                    {#if attaching === "exempt"}
                      <div class="attach-form">
                        <label>DEF 14A Link</label>
                        <input bind:value={esLink} placeholder="https://www.sec.gov/..." />
                        <label>Item Number</label>
                        <input bind:value={esItem} placeholder="e.g. Item 4" />
                        <label class="chk"><input type="checkbox" bind:checked={esVol} /> Voluntary $5M filing</label>
                        <label>Exempt Solicitation PDF <span class="req">*</span></label>
                        <input type="file" accept="application/pdf" on:change={(e) => (esFile = e.target.files[0])} />
                        <div class="attach-actions">
                          <button class="attach-save" disabled={attachBusy} on:click={() => submitAttach(pv.id)}>{attachBusy ? "Attaching…" : "Attach exempt solicitation"}</button>
                          <button class="attach-cancel" on:click={() => (attaching = null)}>Cancel</button>
                        </div>
                      </div>
                    {:else}
                      <button class="attach-open" on:click={() => startAttach("exempt")}>+ Attach exempt solicitation</button>
                    {/if}
                  {/if}
                </div>
              {:else}
                <div class="mat-body">
                  {#if na}
                    <div class="grid">
                      <div>Exclusion Basis</div>
                      <div>
                        {#if parseBases(na.exclusion_basis).length}
                          <span class="basis-inline">{parseBases(na.exclusion_basis).join(", ")}</span>
                        {:else}-{/if}
                      </div>
                      <div>Notice Date</div><div>{na.notice_date ? fmtDate(na.notice_date) : "-"}</div>
                      <div>Status</div><div>{na.status}</div>
                    </div>
                    {#if na.company_letter_pdf_s3_key}<a class="pdf-link" href={`/${na.company_letter_pdf_s3_key}`} target="_blank">📄 Company letter — {cleanFileName(na.company_letter_pdf_filename)}</a>{/if}
                    {#if na.response_pdf_s3_key}<a class="pdf-link" href={`/${na.response_pdf_s3_key}`} target="_blank">📄 Proponent response — {cleanFileName(na.response_pdf_filename)}</a>{/if}
                    <div class="remove-row">
                      <button class="remove-doc" on:click={() => removeAttachment(na.id, "no_action")}>
                        ✕ Remove no-action / exclusion
                      </button>
                    </div>
                  {:else}
                    <p class="muted">No no-action filing on record</p>
                    {#if attaching === "no_action"}
                      <div class="attach-form">
                        <label>Exclusion Basis <span class="req">*</span> <span class="muted">(select all that apply)</span></label>
                        <div class="basis-check">
                          {#each EXCLUSION_BASES as b}
                            <label class="basis-check-item">
                              <input type="checkbox" checked={naBases.includes(b)} on:change={() => toggleNaBasis(b)} />
                              <span class="basis-text">
                                {#if b.includes(" — ")}<strong>{b.split(" — ")[0]}</strong> — {b.split(" — ").slice(1).join(" — ")}{:else}<strong>{b}</strong>{/if}
                              </span>
                            </label>
                          {/each}
                        </div>
                        <label>Notice Date</label>
                        <input type="date" bind:value={naNotice} />
                        <label>Company Exclusion Letter (PDF)</label>
                        <input type="file" accept="application/pdf" on:change={(e) => (naLetterFile = e.target.files[0])} />
                        <label>Proponent Response (PDF)</label>
                        <input type="file" accept="application/pdf" on:change={(e) => (naResponseFile = e.target.files[0])} />
                        <div class="attach-actions">
                          <button class="attach-save" disabled={attachBusy} on:click={() => submitAttach(pv.id)}>{attachBusy ? "Attaching…" : "Attach no-action"}</button>
                          <button class="attach-cancel" on:click={() => (attaching = null)}>Cancel</button>
                        </div>
                      </div>
                    {:else}
                      <button class="attach-open" on:click={() => startAttach("no_action")}>+ Attach no-action / exclusion</button>
                    {/if}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="vote-section">
              <div class="vote-head">
                <span class="vote-title">Vote Results</span>
                <span class="vote-divider"></span>
                <span class="vote-meta">Admin only · Post-AGM</span>
                <span class="vote-i">i</span>
                <span class="vote-hint">Enter the final voting percentages after the annual meeting.</span>
              </div>

              <div class="vote-grid">
                <div class="vote-cell c-for">
                  <label>For</label>
                  <div class="vote-field"><input type="number" min="0" max="100" step="1" placeholder="0.00" bind:value={vf} /><span class="pct">%</span></div>
                </div>
                <div class="vote-cell c-against">
                  <label>Against</label>
                  <div class="vote-field"><input type="number" min="0" max="100" step="1" placeholder="0.00" bind:value={vag} /><span class="pct">%</span></div>
                </div>
                <div class="vote-cell c-abstain">
                  <label>Independent</label>
                  <div class="vote-field"><input type="number" min="0" max="100" step="1" placeholder="0.00" bind:value={vab} /><span class="pct">%</span></div>
                </div>
              </div>

              <div class="vote-total-row">
                <span class="vote-total-label">Total percentage</span>
                <span class="vote-total-val" class:over={voteTotal > 100}>{voteTotal.toFixed(2)}% / 100.00%</span>
              </div>
              <div class="vote-bar"><div class="vote-bar-fill" class:over={voteTotal > 100} style="width:{Math.min(100, voteTotal)}%"></div></div>

              <div class="vote-foot">
                <button class="vote-save" on:click={() => saveVotes(pv.id)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save vote results
                </button>
                <span class="vote-foot-divider"></span>
                <span class="vote-foot-note"><span class="vote-i sm">i</span> Results remain hidden from the public website until published.</span>
              </div>
            </div>
          {/if}

          <div class="section">
            <h4>ADMIN NOTES</h4>

            <div class="note-row">
              <textarea bind:value={adminNote} placeholder="Add review note..."
              ></textarea>
              <button class="add-btn">ADD</button>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="modal-footer">
          {#if editMode}
            <button class="edit-cancel" on:click={cancelEdit}>Cancel</button>
            <button class="edit-save" on:click={saveEdit}>Save changes</button>
          {:else}
            <button class="edit-btn" on:click={startEdit}>✎ Edit</button>
          {/if}
          <button
            class="approve"
            on:click={() => updateStatus(selectedFiling.id, "approved")}
          >
            ✓ APPROVE
          </button>

          <button
            class="reject"
            on:click={() => updateStatus(selectedFiling.id, "rejected")}
          >
            ✕ REJECT
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Admin "Submit Exempt Solicitation" popup hidden for now (A1) — awaiting client approval.
<AdminSubmitModal bind:open={showAdminSubmit} />
-->

<style>
  body {
    font-family: var(--sans);
  }
  .container {
    padding: 40px 10px;
    background: var(--paper);
  }

  .title.s-8yXO12Wbi8z8 {
    margin-bottom: 25px;
    font-size: 28px;
    color: #1a3a5c;
    font-family: "DM Serif Display", Georgia, serif !important;
  }

  /* STATS */
  .stats {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
  }
  .stat-card {
    flex: 1;
    background: #fff;
    border-radius: 6px;
    padding: 20px;
    text-align: center;
    border: 1px solid var(--g2);
    box-shadow: var(--shadow-sm);
  }

  .num {
    font-family: "DM Serif Display", Georgia, serif !important;
    font-size: 36px;
    line-height: 1;
    font-weight: normal;
  }

  .pending {
    color: var(--orange);
  }
  .approved {
    color: var(--green);
  }
  .rejected {
    color: var(--red);
  }
  .total {
    color: var(--blue);
  }

  .label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--g4);
    margin-top: 6px;
  }

  /* TABS */
  .tabs {
    display: flex;
    gap: 30px;
    border-bottom: 1px solid #ddd;
    margin-bottom: 20px;
    font-family: "IBM Plex Mono", "Courier New", monospace !important;
  }

  .tabs div {
    padding-bottom: 10px;
    cursor: pointer;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--g4);
  }

  .tabs .active {
    border-bottom: 2px solid #1a3a5c;
    color: var(--blue);
    font-weight: 600;
  }

  .badge {
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 6px;
    font-weight: 600;
  }

  /* TABLE */
  .table-wrap {
    background: white;
    border-radius: 10px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;   /* fixed widths → always fits, nothing clipped */
  }

  .filing-table thead th {
    background: var(--paper-warm);
    text-align: left;
    padding: 11px 6px;
    font-size: 10px !important;
    font-weight: 600;
    letter-spacing: 0.06em !important;
    text-transform: uppercase;
    color: var(--g4);
    border-bottom: 1px solid var(--g2);
    vertical-align: bottom;
    line-height: 1.2;
    white-space: normal !important;
    word-break: break-word;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  /* !important beats the global app.css ".filing-table td{vertical-align:top}"
     (Svelte scopes with :where() = 0 specificity, so it can't win on its own).
     Centers every admin row's content incl. the action buttons in tall rows. */
  .filing-table td { padding: 10px 8px; vertical-align: middle !important; }

  td {
    padding: 10px 8px;
    border-top: 1px solid #eee;
    font-size: 14px; /* match the home listing table */
    vertical-align: middle;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* fixed column widths (sum = 100%) so the table never overflows */
  th:nth-child(1), td:nth-child(1) { width: 8%; }    /* DATE */
  th:nth-child(2), td:nth-child(2) { width: 21%; }   /* COMPANY */
  th:nth-child(3), td:nth-child(3) { width: 14%; }   /* FILER */
  th:nth-child(4), td:nth-child(4) { width: 15%; }   /* TOPIC */
  th:nth-child(5), td:nth-child(5) { width: 8%; text-align: center; }   /* STATUS */
  th:nth-child(6), td:nth-child(6) { width: 7%; text-align: center; }   /* NO-ACTION */
  th:nth-child(7), td:nth-child(7) { width: 10%; text-align: center; }  /* EXEMPT SOL */
  th:nth-child(8), td:nth-child(8) { width: 17%; min-width: 130px; }    /* ACTIONS */

  .link {
    color: #2b6cb0;
    font-weight: bold;
  }

  .sub {
    font-size: 11px;
    color: #777;
  }

  /* STATUS — matches prototype .status-badge */
  .status {
    display: inline-block;
    font-family: "IBM Plex Mono", "Courier New", monospace;
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .status.pending {
    background: var(--orange-light);
    color: var(--orange);
  }

  .status.approved {
    background: var(--green-light);
    color: var(--green);
  }

  .status.rejected {
    background: var(--red-light);
    color: var(--red);
  }

  /* ACTIONS — icon buttons (single horizontal row) */
  /* NOTE: .actions IS the <td>. Keep it a normal table-cell (do NOT make it
     display:flex — that pulls it out of the row and pins the buttons to the top).
     vertical-align:middle (from .filing-table td) then centers the inline-flex
     buttons vertically, even when the Company name wraps to multiple lines. */
  .actions {
    white-space: nowrap;
    text-align: left;
    font-size: 0; /* collapse inline whitespace between the icon buttons */
  }
  .actions .icon + .icon { margin-left: 5px; }
  .actions .icon {
    vertical-align: middle;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: pointer;
  }
  .actions .icon svg { width: 15px; height: 15px; }
  .actions .icon:hover { filter: brightness(0.95); }

  .review {
    border: 1px solid #2b6cb0;
    color: #2b6cb0;
    background: #e8f0fe;
  }
  .approve {
    border: 1px solid green;
    color: green;
    background-image: #e6f4ea;
  }
  .reject {
    border: 1px solid red;
    color: red;
    background-color: #fde8e4;
  }

  .delete {
    border: 1px solid #ccc;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 60px 20px 24px; /* room on the sides so the wider modal never touches the edge */
    z-index: 999;
    overflow-y: auto; /* the whole modal flows and scrolls here, like the artifact */
  }

  .modal {
    width: 100%;
    max-width: 860px; /* matches the public proposal popup + artifact */
    margin-bottom: 40px;
    background: var(--paper);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    background: var(--blue);
    color: #fff;
    padding: 18px 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 3px solid var(--gold);
  }
  /* title in the header — matches the public proposal popup (.pd-head h3) */
  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-family: Georgia, "Times New Roman", serif !important;
    font-weight: 400;
    line-height: 1.25;
    color: #fff;
  }
  /* match the home proposal popup's close button (.pd-x) */
  .modal-x {
    background: none;
    border: none;
    color: #fff;
    font-size: 26px;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.85;
    padding: 0;
  }
  .modal-x:hover { opacity: 1; }

  /* search box */
  .admin-search {
    flex: 1;
    min-width: 200px;
    max-width: 420px;
    padding: 8px 12px;
    border: 1px solid var(--g2);
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
  }
  .admin-search:focus { outline: none; border-color: #1a3a5c; }

  /* pagination */
  .admin-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin: 18px 0 4px;
    font-family: "IBM Plex Mono", "Courier New", monospace;
  }
  .pg-btn {
    background: #fff;
    border: 1px solid #1a3a5c;
    color: #1a3a5c;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .pg-btn:hover:not(:disabled) { background: #1a3a5c; color: #fff; }
  .pg-btn:disabled { opacity: 0.4; cursor: default; }
  .pg-text { font-size: 12px; color: #6b7585; }
  .empty-row { text-align: center; color: #9aa3af; padding: 26px; font-size: 14px; }

  .modal-body {
    padding: 28px;
    /* no inner scroll — the overlay scrolls the whole modal (matches the artifact) */
    overflow-x: hidden; /* prevent horizontal scroll */
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .modal-body a {
    word-break: break-all; /* 🔥 ensures long URLs wrap */
  }

  .grid div {
    word-break: break-word;
  }
  .grid div:nth-child(2) {
    white-space: normal;
    word-break: break-word;
  }
  .modal-footer {
    padding: 15px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* ── inline admin edit ── */
  .edit-input {
    width: 100%; font-family: var(--sans) !important; font-size: 13.5px;
    padding: 6px 9px; border: 1.5px solid var(--g2); border-radius: 4px;
    background: #fff; color: var(--ink);
  }
  .edit-input:focus { outline: none; border-color: var(--blue-light); }
  .edit-textarea { min-height: 84px; resize: vertical; line-height: 1.5; margin-top: 4px; }
  .edit-meeting { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .edit-meeting .edit-input { width: auto; }
  .company-ta { position: relative; }
  .company-ta-dd {
    position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 30;
    background: #fff; border: 1.5px solid var(--blue-light); border-radius: 4px;
    box-shadow: var(--shadow-lg); max-height: 220px; overflow-y: auto;
  }
  .company-ta-dd .ta-item {
    display: block; width: 100%; text-align: left; cursor: pointer;
    padding: 8px 10px; background: none; border: none; border-bottom: 1px solid var(--g1);
    font-family: var(--sans) !important;
  }
  .company-ta-dd .ta-item:last-child { border-bottom: none; }
  .company-ta-dd .ta-item:hover { background: var(--paper); }
  .company-ta-dd .ta-item strong { display: block; color: var(--blue); font-size: 13px; }
  .company-ta-dd .ta-item small { color: var(--g4); font-family: var(--mono); font-size: 11px; }
  .modal-footer .edit-btn,
  .modal-footer .edit-save,
  .modal-footer .edit-cancel {
    padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;
    font-family: var(--sans) !important;
  }
  .modal-footer .edit-btn { background: #fff; border: 1px solid var(--blue); color: var(--blue); margin-right: auto; }
  .modal-footer .edit-btn:hover { background: #eef2fb; }
  .modal-footer .edit-save { background: var(--blue); border: 1px solid var(--blue); color: #fff; margin-right: auto; }
  .modal-footer .edit-save:hover { background: var(--blue-light); }
  .modal-footer .edit-cancel { background: #fff; border: 1px solid var(--g2); color: var(--g5); }
  .modal-footer .edit-cancel:hover { background: var(--paper-warm); }

  .status-row {
    display: flex !important;
    justify-content: flex-end !important;
    width: 100% !important;
  }
  .section {
    margin-top: 15px;
  }

  .pdf-link {
    display: inline-block;
    background: #fde8e4;
    padding: 6px 10px;
    border-radius: 6px;
    color: #b91c1c;
    text-decoration: none;
    margin: 10px 0;
  }

  textarea {
    width: 100%;
    margin-top: 10px;
    padding: 10px;
  }

  .add-btn {
    margin-top: 10px;
  }

  .modal-footer .approve {
    background: #e6f4ea;
    border: 1px solid #2f855a;
    color: #2f855a;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-footer .approve:hover {
    background: #c6f6d5;
  }

  .modal-footer .reject {
    background: #fde8e4;
    border: 1px solid #c53030;
    color: #c53030;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-footer .reject:hover {
    background: #fbd5d5;
  }

  .modal-footer .edit {
    background: #e8f0fe;
    border: 1px solid #2b6cb0;
    color: #2b6cb0;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-footer .edit:hover {
    background: #e8f0fe;
  }

  .modal-footer .save {
    background: #fde8e4;
    border: 1px solid #c53030;
    color: #c53030;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-footer .save:hover {
    background: #fbd5d5;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tag {
    background: #d1fae5;
    color: #065f46;
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 6px;
  }

  /* matches the public proposal popup (.pd-company) */
  .main-title {
    margin: 0 0 6px;
    font-size: 25px;
    color: #1a3a5c;
    font-family: Georgia, "Times New Roman", serif !important;
    font-weight: 400;
  }

  .date {
    font-size: 12px;
    color: #777;
    margin: 0 0 6px;
  }

  /* matches the public proposal popup (.pd-grid) */
  .grid {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 11px 16px;
    font-size: 13.5px;
    align-items: start;
  }
  .grid > div:nth-child(odd) {
    color: #7a8699;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-top: 2px;
  }
  .grid > div:nth-child(even) {
    color: #1f2937;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .grid a { color: #1a3a5c; }
  .muted { color: #9aa3af; font-size: 12px; }
  .callout {
    background: #eef2fb;
    border-left: 4px solid #27418a;
    padding: 12px 14px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.5;
    margin: 10px 0 0;
  }
  .callout-label {
    font-size: 11px;
    letter-spacing: 0.04em;
    color: #27418a;
    font-weight: 700;
    margin-bottom: 6px;
  }

  /* LIFECYCLE STRIP — matches the public proposal popup (.pd-life): no divider lines */
  .lifecycle {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin: 20px 0 18px;
    padding: 18px 6px;
  }
  .lifecycle .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
  }
  .lifecycle .step:not(:last-child)::after {
    content: "";
    position: absolute;
    top: 7px;
    left: 50%;
    width: 100%;
    height: 2px;
    background: #e3e6ea;
    z-index: 0;
  }
  .lifecycle .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #c3c9d2;
    background: #fff;
    z-index: 1;
    margin-bottom: 6px;
  }
  .lifecycle .step.done .dot { border-color: #1a3a5c; background: #1a3a5c; }
  .lifecycle .step-label { font-size: 9.5px; letter-spacing: 0.02em; color: #6b7585; font-weight: 600; line-height: 1.2; }
  .lifecycle .step-sub { font-size: 10px; color: #9aa3af; margin-top: 2px; }

  /* section headers — match the public proposal popup (pd h4) */
  .modal-body h4 {
    margin: 0 0 12px;
    font-size: 12px;
    letter-spacing: 0.05em;
    color: #1a3a5c;
    border-bottom: 1px solid #e7e4dc;
    padding-bottom: 7px;
  }

  /* TWO-COLUMN BLOCKS — matches .pd-two */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px 52px;
    margin-top: 16px;
  }

  /* MATERIAL TABS — matches .pd-wm / .pd-tabs */
  .modal-body .wm-head {
    font-family: Georgia, "Times New Roman", serif !important;
    font-size: 18px; color: #1a3a5c; text-transform: none;
    letter-spacing: 0; margin: 26px 0 12px;
    border-bottom: none; padding-bottom: 0; font-weight: 400;
  }
  .mat-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e3e6ea; margin: 0; }
  .mat-tabs button {
    background: none; border: none; border-bottom: 2px solid transparent;
    padding: 10px 14px; font-size: 11.5px; letter-spacing: 0.02em; color: #6b7585;
    cursor: pointer; font-family: var(--mono, monospace);
  }
  .mat-tabs button.active { color: #1a3a5c; border-bottom-color: #c9a84c; font-weight: 600; }
  .mat-body {
    border: 1px solid #ecece6;
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 18px;
    background: #fff;
  }
  .remove-row { margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e3ddd0; }
  .remove-doc {
    background: #fff; border: 1px solid #d9b4b0; color: #b23b32;
    padding: 7px 12px; border-radius: 6px; cursor: pointer;
    font-size: 12px; letter-spacing: 0.02em; font-weight: 600;
  }
  .remove-doc:hover { background: #fbecea; border-color: #c53030; }

  /* attachment filter bar */
  .filter-bar {
    display: flex; align-items: center; gap: 10px; margin: 0 0 14px;
    font-family: "IBM Plex Mono", "Courier New", monospace;
  }
  .filter-label { font-size: 11px; letter-spacing: 0.05em; color: #6b7585; }
  .filter-bar select {
    padding: 7px 10px; border: 1px solid var(--g2); border-radius: 6px;
    background: #fff; font-size: 13px; color: #1f2937;
  }
  .filter-count { font-size: 12px; color: #9aa3af; }

  /* admin attach + vote inline forms */
  .attach-open {
    margin-top: 12px; background: #1a3a5c; color: #fff; border: none;
    padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
  }
  .attach-open:hover { background: #16324a; }
  .attach-form {
    margin-top: 12px; padding: 14px; border: 1px solid #e3ddd0; border-radius: 8px; background: #fbfaf7;
    display: flex; flex-direction: column; gap: 4px;
  }
  .attach-form label { font-size: 11px; letter-spacing: 0.03em; color: #6b7585; margin-top: 8px; }
  .attach-form label.chk { display: flex; align-items: center; gap: 8px; color: #1f2937; margin-top: 10px; }
  .attach-form input, .attach-form select {
    padding: 8px 10px; border: 1px solid var(--g2); border-radius: 6px; font-size: 13px; background: #fff;
  }
  .attach-form input[type="file"] { padding: 6px; background: #fff; }
  .basis-check {
    display: grid; grid-template-columns: 1fr 1fr; gap: 11px 22px;
    padding: 14px; border: 1px solid #e2ddd0; border-radius: 8px; background: #fff;
  }
  .basis-check-item { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; line-height: 1.35; color: #3a3f47; cursor: pointer; }
  .basis-check-item input[type="checkbox"] {
    appearance: none; -webkit-appearance: none; flex: 0 0 auto;
    width: 18px; height: 18px; margin: 1px 0 0; border: 1.5px solid #c7bfae;
    border-radius: 4px; background: #fff; cursor: pointer; position: relative;
  }
  .basis-check-item input[type="checkbox"]:checked { background: #1a3a5c; border-color: #1a3a5c; }
  .basis-check-item input[type="checkbox"]:checked::after {
    content: "✓"; color: #fff; font-size: 12px; line-height: 1; font-weight: 700;
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  }
  .basis-text strong { color: #1a3a5c; font-weight: 700; }
  .basis-inline { color: #1f2937; line-height: 1.5; }
  .req { color: #c53030; }
  .attach-actions { display: flex; gap: 10px; margin-top: 14px; }
  .attach-save {
    background: #2f855a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px;
    font-weight: 600; cursor: pointer; font-size: 13px;
  }
  .attach-save:disabled { opacity: 0.6; cursor: default; }
  .attach-cancel {
    background: #fff; border: 1px solid #ccc; color: #555; padding: 8px 16px; border-radius: 6px; cursor: pointer;
  }

  /* VOTE RESULTS panel — brand-kit styling */
  .vote-section {
    margin-top: 18px;
    background: #fbf8f0;
    border: 1px solid rgba(201, 168, 76, 0.45);
    border-radius: 10px;
    padding: 18px 20px 20px;
  }
  .vote-head {
    display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
    margin-bottom: 16px;
  }
  /* match the "Written Materials" heading exactly: Georgia serif, navy */
  .vote-title {
    font-family: Georgia, "Times New Roman", serif !important; font-size: 18px; font-weight: 400; color: #1a3a5c;
    text-transform: none; letter-spacing: 0;
  }
  .vote-divider { width: 1px; height: 15px; background: var(--g2); }
  .vote-meta {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
    color: var(--g4); text-transform: uppercase;
  }
  .vote-i {
    flex: 0 0 auto; width: 17px; height: 17px; border-radius: 50%;
    background: var(--gold); color: var(--blue); font-family: var(--serif) !important;
    font-size: 11px; font-style: italic; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .vote-i.sm { width: 15px; height: 15px; font-size: 10px; }
  .vote-hint { font-family: var(--sans) !important; font-size: 13px; color: var(--g5); flex: 1 1 200px; }

  .vote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .vote-cell { border-radius: 8px; padding: 12px 14px 14px; border: 1px solid var(--g2); background: #fff; }
  .vote-cell label {
    display: block; font-family: var(--mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;
  }
  .vote-cell.c-for { background: var(--green-light); border-color: #bfe0c8; }
  .vote-cell.c-for label { color: var(--green); }
  .vote-cell.c-against { background: var(--red-light); border-color: #f0c7bf; }
  .vote-cell.c-against label { color: var(--red); }
  .vote-cell.c-abstain { background: var(--paper); border-color: var(--g2); }
  .vote-cell.c-abstain label { color: var(--g4); }

  .vote-field { position: relative; }
  .vote-field input {
    width: 100%; box-sizing: border-box; padding: 9px 30px 9px 12px;
    border: 1px solid var(--g2); border-radius: 6px; font-size: 16px;
    font-family: var(--sans) !important; background: #fff; color: var(--ink);
  }
  .vote-field input:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 2px rgba(26, 58, 92, 0.08); }
  .vote-field .pct { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--g3); font-size: 13px; pointer-events: none; }

  .vote-total-row { display: flex; justify-content: space-between; align-items: baseline; margin: 16px 0 8px; }
  .vote-total-label { font-family: var(--sans) !important; font-size: 12px; color: var(--g4); font-weight: 500; }
  .vote-total-val { font-family: var(--sans) !important; font-size: 12px; color: var(--g4); font-weight: 400; }
  .vote-total-val.over { color: var(--red); font-weight: 600; }
  .vote-bar { height: 8px; border-radius: 6px; background: #e8dfcd; overflow: hidden; }
  .vote-bar-fill { height: 100%; background: var(--blue); border-radius: 6px; transition: width 0.25s ease; }
  .vote-bar-fill.over { background: var(--red); }

  .vote-foot { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
  .vote-save {
    order: 3; margin-left: auto; /* push Save button to the right */
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--blue); color: #fff; border: none;
    padding: 11px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;
    font-size: 13px; font-family: var(--sans) !important;
  }
  .vote-save:hover { background: var(--blue-light); }
  .vote-save svg { display: block; }
  .vote-foot-divider { display: none; }
  .vote-foot-note {
    order: 1; /* keep the note on the left */
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--sans) !important; font-size: 12.5px; color: var(--g4);
  }
  @media (max-width: 640px) { .vote-grid { grid-template-columns: 1fr; } }
  .pdf-link {
    display: block;
    width: fit-content;
    max-width: 100%;
    word-break: break-word;
  }
  .topic-chip {
    display: inline-block;
    max-width: 100%;
    background: #e8f0fe;
    color: var(--blue);
    font-family: "IBM Plex Mono", "Courier New", monospace;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.35;
    padding: 3px 8px;
    border-radius: 3px;
    white-space: normal;
    word-break: break-word;
  }
  .yn {
    font-family: "IBM Plex Mono", "Courier New", monospace;
    font-size: 11px;
    font-weight: 600;
  }
  .yn.yes { color: var(--green); background: var(--green-light); padding: 2px 8px; border-radius: 3px; }
  .yn.no { color: var(--g3); font-weight: 400; }
  .pp-interest {
    display: inline-block; font-family: "IBM Plex Mono", "Courier New", monospace;
    font-size: 11px; font-weight: 600; color: var(--blue);
    background: #fdf3d6; border: 1px solid var(--gold); padding: 2px 8px; border-radius: 3px;
  }

  /* .grid div:first-child {
    color: #777;
    text-transform: uppercase;
    font-size: 11px;
  } */

  .note-row {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .note-row textarea {
    flex: 1;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }

  .add-btn {
    background: #1a3a5c;
    color: white;
    padding: 0 18px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
  }

  .add-btn:hover {
    background: #16324a;
  }

  .admin-submit-btn {
    margin-left: auto;
    /* lift the button off the tabs underline so it sits above the line, not on it */
    align-self: center;
    margin-bottom: 10px;
    background: #1a3a5c;
    color: white;
    padding: 10px 18px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
  }

  .title-edit {
    width: 100%;
  }

  .title-input {
    width: 100%;
    box-sizing: border-box;
  }
</style>
