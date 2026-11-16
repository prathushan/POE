<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import ProposalDetail from "$lib/ProposalDetail.svelte";
  import { fmtDate } from "$lib/formatDate.js";
  import linkIcon from "$lib/assets/link-icon.png";
  import linkedinLogo from "$lib/assets/linkedin-logo.png";
  let search = $state("");
  let prevSearch = ""; // ✅ FIX ADDED
  let filings = $state([]);
  let selectedFiling = $state(null);
  let stats = $state({
    total: 0,
    companies: 0,
    filers: 0,
    pending: 0,
  });

  let sortColumn = $state("created_at");
  let sortDirection = $state("desc"); // newest first, so just-approved proposals show on top

  let detailOpen = $state(false);

  function openModal(filing) {
    // Proposal-centric: clicking a row opens the unified detail popup.
    selectedFiling = filing;
    detailOpen = true;
  }

  function closeModal() {
    detailOpen = false;
    selectedFiling = null;
  }

  // the selected proposal's approved attachments (for the detail popup tabs)
  const detailExempt = $derived(
    selectedFiling
      ? filings.find((x) => x.proposal_id === selectedFiling.id && x.filing_type === "exempt_solicitation") ?? null
      : null
  );
  const detailNoAction = $derived(
    selectedFiling
      ? filings.find((x) => x.proposal_id === selectedFiling.id && x.filing_type === "no_action") ?? null
      : null
  );

  // ── proposal-centric helpers ──
  const isLegacy = (f) =>
    f.filing_type === "exempt_solicitation" && !f.proposal_id;
  const isIndexRow = (f) => f.filing_type === "proposal" || isLegacy(f);
  const companyLabel = (f) =>
    f.filing_type === "proposal" ? f.company_name || "-" : f.memo_submitter || f.company_name || "-";
  const topicLabel = (f) => f.proposal_topic || f.subject || "";
  const exemptLabel = (f) => (isLegacy(f) ? "Legacy" : f.has_exempt_solicitation ? "Yes" : "No");
  const noActionLabel = (f) => (isLegacy(f) ? "—" : f.has_no_action ? "Yes" : "No");
  const exclusionLabel = (f) =>
    isLegacy(f) ? "—" : f.proxy_status ? f.proxy_status.charAt(0).toUpperCase() + f.proxy_status.slice(1) : "Pending";

  function colValue(f, col) {
    switch (col) {
      case "company": return companyLabel(f).trim().toLowerCase();
      case "created_at": return new Date(f.created_at).getTime();
      case "filer": return (f.filer_name || "").trim().toLowerCase();
      case "topic": return topicLabel(f).trim().toLowerCase();
      case "exempt": return exemptLabel(f).toLowerCase();
      case "no_action": return noActionLabel(f);
      case "exclusion": return exclusionLabel(f).toLowerCase();
      default: return "";
    }
  }

  function arrow(col) {
    // non-breaking space so the arrow never drops to its own line below the label
    if ((sortColumn || "company") !== col) return " ↕";
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  // Dynamic tracker — computed from the live approved data, so it updates
  // automatically whenever records are added/removed (on next load of public data).
  const tracker = $derived.by(() => {
    const indexRows = filings.filter(isIndexRow);
    const companies = new Set(
      indexRows.map((f) => companyLabel(f).trim().toLowerCase()).filter(Boolean)
    );
    const filers = new Set(
      filings.map((f) => (f.filer_name || "").trim().toLowerCase()).filter(Boolean)
    );
    return {
      proposals: filings.filter((f) => f.filing_type === "proposal").length,
      noAction: filings.filter((f) => f.filing_type === "no_action").length,
      exempt: filings.filter((f) => f.filing_type === "exempt_solicitation").length,
      companies: companies.size,
      filers: filers.size,
    };
  });

  // pagination
  let currentPage = $state(1);
  const pageSize = 10;

  onMount(async () => {
    const res = await fetch("/api/filings/public");
    filings = await res.json();

    const statsRes = await fetch("/api/filings/stats");
    stats = await statsRes.json();
  });

  function getPaginated() {
    const start = (currentPage - 1) * pageSize;
    return filteredFilings.slice(start, start + pageSize);
  }

  function totalPages() {
    return Math.ceil(filteredFilings.length / pageSize) || 1;
  }

  function getShareUrl() {
    if (!selectedFiling) return "#";

    return `${window.location.origin}/filing/${selectedFiling.id}`;
  }

  function sortBy(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "asc";
    }
  }

  // const filteredFilings = $derived(
  //   filings.filter((f) => {
  //     const term = search.toLowerCase();

  //     return (
  //       f.company_name?.toLowerCase().includes(term) ||
  //       f.filer_name?.toLowerCase().includes(term) ||
  //       f.company_cik?.includes(term) ||
  //       f.filer_cik?.includes(term) ||
  //       f.memo_submitter?.toLowerCase().includes(term) ||
  //       f.created_at?.toLowerCase().includes(term) ||
  //       f.accession_number?.toLowerCase().includes(term)
  //     );
  //   }),
  // );

  const filteredFilings = $derived.by(() => {
    const term = search.toLowerCase();
    let filtered = filings.filter((f) => {
      // proposal-centric: only proposals + legacy standalone exempt solicitations
      if (!isIndexRow(f)) return false;
      if (!term) return true;
      return (
        companyLabel(f).toLowerCase().includes(term) ||
        f.filer_name?.toLowerCase().includes(term) ||
        f.company_cik?.includes(term) ||
        f.filer_cik?.includes(term) ||
        topicLabel(f).toLowerCase().includes(term) ||
        f.proposal_text?.toLowerCase().includes(term) ||
        f.exclusion_basis?.toLowerCase().includes(term)
      );
    });

    // default sort: Company A–Z
    const col = sortColumn || "company";
    filtered = [...filtered].sort((a, b) => {
      const va = colValue(a, col);
      const vb = colValue(b, col);
      let cmp;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  });

  $effect(() => {
    currentPage = 1;
  });
</script>

<svelte:head>
  <title>POE | Home</title>
</svelte:head>

<!-- SEARCH HERO -->
<div class="search-hero">
  <div class="container">
    <h2>Search Proposals</h2>
    <!-- <p>Browse shareholder proposals, no-action/exclusion notices, and exempt solicitations filed on the Proxy Open Exchange.</p> -->

    <div class="search-box">
      <input
        bind:value={search}
        placeholder="Search by company, filer, proposal topic, or resolution text..."
      />
      <button>Search</button>
    </div>
  </div>
</div>

<!-- MAIN -->
<div class="container main-layout">
  <!-- LEFT TABLE -->
  <div>
    <div class="section-header">
      <h3>All Proposals</h3>
    </div>

    <!-- ✅ SHOWING TEXT -->
    <p style="margin:10px 0; font-size:13px; color:#666;">
      {#if filings.length === 0}
        Showing 0 filings
      {:else}
        Showing {Math.min((currentPage - 1) * pageSize + 1, filteredFilings.length)}
        –
        {Math.min(currentPage * pageSize, filteredFilings.length)}
        of {filteredFilings.length} filings
      {/if}
    </p>

    <table class="filing-table">
      <!-- <thead>
        <tr>
          <th>Company</th>
         
           <th>Form</th> 
          <th>Submitted By</th>
        
          <th>Proposal Topic</th>
           <th>Posted</th>
        </tr>
      </thead> -->

      <thead>
        <tr>
          <th on:click={() => sortBy("company")}>Company{arrow("company")}</th>
          <th on:click={() => sortBy("created_at")}>Date{arrow("created_at")}</th>
          <th on:click={() => sortBy("filer")}>Filer{arrow("filer")}</th>
          <th on:click={() => sortBy("topic")}>Proposal Topic{arrow("topic")}</th>
          <th class="ctr" on:click={() => sortBy("exempt")}>Exempt Solicitation{arrow("exempt")}</th>
          <th class="ctr" on:click={() => sortBy("no_action")}>No-Action{arrow("no_action")}</th>
          <th class="ctr" on:click={() => sortBy("exclusion")}>Exclusion{arrow("exclusion")}</th>
        </tr>
      </thead>
      <tbody>
        {#if filteredFilings.length === 0}
          <tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">No proposals yet</td></tr>
        {:else}
          {#each getPaginated() as f}
            <tr class="clickable-row" on:click={() => openModal(f)}>
              <td>
                <strong>{companyLabel(f)}</strong>
                {#if isLegacy(f)}<br /><span class="legacy-tag">Legacy filing</span>{/if}
              </td>
              <td class="nowrap">{fmtDate(f.created_at)}</td>
              <td>{f.filer_name || "-"}</td>
              <td>{#if topicLabel(f)}<span class="topic-badge">{topicLabel(f)}</span>{:else}—{/if}</td>
              <td class="ctr"><span class={exemptLabel(f) === 'Yes' ? 'yn-yes' : exemptLabel(f) === 'Legacy' ? 'yn-legacy' : 'yn-no'}>{exemptLabel(f)}</span></td>
              <td class="ctr"><span class={noActionLabel(f) === 'Yes' ? 'yn-yes' : 'yn-no'}>{noActionLabel(f)}</span></td>
              <td class="ctr">{#if exclusionLabel(f) === '—'}<span class="yn-no">—</span>{:else}<span class="proxy-status-badge proxy-{exclusionLabel(f).toLowerCase()}">{exclusionLabel(f)}</span>{/if}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    <ProposalDetail bind:open={detailOpen} record={selectedFiling} exempt={detailExempt} noAction={detailNoAction} />
    <!-- ✅ PAGINATION -->
    <div class="pagination">
      <button
        class="pagination-btn"
        disabled={currentPage === 1}
        on:click={() => currentPage--}
      >
        ← Previous
      </button>

      <span class="pagination-text">
        Page {currentPage} / {totalPages()}
      </span>

      <button
        class="pagination-btn"
        disabled={currentPage === totalPages()}
        on:click={() => currentPage++}
      >
        Next →
      </button>
    </div>
  </div>

  <!-- RIGHT SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-card">
      <div class="sidebar-card-header">Proposal Tracker</div>
      <div class="sidebar-card-body">
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-number">{tracker.companies}</div>
            <div class="stat-label">Companies</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{tracker.filers}</div>
            <div class="stat-label">Filers</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{tracker.proposals}</div>
            <div class="stat-label">Proposals</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{tracker.noAction}</div>
            <div class="stat-label">No-Action</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{tracker.exempt}</div>
            <div class="stat-label">Exempt Solicitation</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{stats.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-card-header">Resources</div>
      <div class="sidebar-card-body">
        <ul class="resource-list">
          <li>
            <a
              href="https://www.sec.gov/about/divisions-offices/division-corporation-finance/proxy-rules-schedules-14a14c-notice-012725"
              target="_blank"
              rel="noopener noreferrer"
            >
              → SEC Rule Change
            </a>
          </li>
          <li>
            <a
              href="https://www.sec.gov/submit-filings/forms-index/aboutformsformidpdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              → Register for a CIK Number
            </a>
          </li>

          <li><a href="/about">→ About POE</a></li>
          <li><a href="/terms">→ Terms</a></li>
        </ul>
      </div>
    </div>
  </div>
</div>

<style>
  /* CLICKABLE ROW */
  .clickable-row {
    cursor: pointer;
  }
  .clickable-row:hover {
    background: #f9f7f3;
  }

  /* proposal-centric index — fixed layout so it never scrolls horizontally */
  .filing-table { table-layout: fixed; width: 100%; }
  .filing-table thead th {
    cursor: pointer; user-select: none;
    white-space: normal; word-break: normal; overflow-wrap: break-word; hyphens: auto;
    font-size: 10px; letter-spacing: 0.03em; color: var(--g4);
    padding: 11px 7px; vertical-align: bottom; line-height: 1.25;
  }
  .filing-table td { word-break: normal; overflow-wrap: break-word; padding: 11px 7px; vertical-align: top; font-size: 13px; }
  .filing-table th:nth-child(1), .filing-table td:nth-child(1) { width: 16%; }  /* Company */
  .filing-table th:nth-child(2), .filing-table td:nth-child(2) { width: 13%; white-space: nowrap; font-size: 11.5px; }  /* Date */
  .filing-table th:nth-child(3), .filing-table td:nth-child(3) { width: 14%; }  /* Filer */
  .filing-table th:nth-child(4), .filing-table td:nth-child(4) { width: 15%; }  /* Proposal Topic */
  .filing-table th:nth-child(5), .filing-table td:nth-child(5) { width: 17%; }  /* Exempt Solicitation */
  .filing-table th:nth-child(6), .filing-table td:nth-child(6) { width: 10%; }  /* No-Action */
  .filing-table th:nth-child(7), .filing-table td:nth-child(7) { width: 15%; }  /* Exclusion */
  .filing-table td.ctr, .filing-table th.ctr { text-align: left; }
  .nowrap { white-space: nowrap; }
  .legacy-tag { font-size: 11px; color: #9a8f78; font-style: italic; }
  /* Status pills — match the prototype (.topic-badge / .yn-yes / .proxy-status-badge) */
  .topic-badge {
    display: inline-block; font-family: var(--mono); font-size: 10px; font-weight: 600;
    padding: 3px 8px; border-radius: 3px; background: #e8f0fe; color: var(--blue);
  }
  .yn-yes {
    display: inline-block; font-family: var(--mono); font-size: 11px; font-weight: 600;
    color: var(--green); background: var(--green-light); padding: 2px 8px; border-radius: 3px;
  }
  .yn-no { font-family: var(--mono); font-size: 11px; color: var(--g3); }
  .yn-legacy {
    display: inline-block; font-family: var(--mono); font-size: 11px; font-weight: 600;
    color: var(--orange); background: var(--orange-light); padding: 2px 8px; border-radius: 3px;
  }
  .proxy-status-badge {
    display: inline-block; font-family: var(--mono); font-size: 10px; font-weight: 600;
    padding: 3px 8px; border-radius: 3px;
  }
  .proxy-included { background: var(--green-light); color: var(--green); }
  .proxy-excluded { background: var(--red-light); color: var(--red); }
  .proxy-withdrawn { background: var(--orange-light); color: var(--orange); }
  .proxy-pending { background: #f0f0ec; color: var(--g4); }

  /* MODAL */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);

    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal {
    position: fixed;
    top: 40px; /* space from top */
    left: 50%;
    transform: translateX(-50%);

    width: 100%;
    max-width: 600px;

    background: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);

    max-height: 97vh; /* prevents overflow */
    overflow-y: auto; /* scroll if content is long */
  }
  /* MODAL */
  .modal {
    width: 760px;
    max-height: 90vh;
    background: #f8f6f2;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* HEADER */
  .modal-header {
    background: #1f3b5b;
    color: #fff;
    padding: 14px 20px;
    font-family: var(--mono);
    font-size: 13px;
    display: flex;
    justify-content: flex-end;
  }

  /* BODY */
  .modal-body {
    padding: 24px 28px;
    overflow-y: auto;
  }

  /* TAG */
  .tag {
    display: inline-block;
    background: #e6f4ea;
    color: #2f855a;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: var(--mono);
    margin-bottom: 10px;
  }

  /* TITLE */
  .modal-title {
    font-size: 20px;
    margin: 10px 0;
    color: #1f3b5b;
    font-weight: 600;
  }

  /* META */
  .meta {
    font-size: 16px;
    color: #777;
    margin-bottom: 15px;
  }

  /* SECTION TITLE */
  .section-title {
    font-size: 16px;
    letter-spacing: 1.5px;
    color: #777;
    margin: 20px 0 10px;
    font-family: var(--mono);
  }

  /* GRID */
  .info-grid {
    display: grid;
    grid-template-columns: 180px 1fr;
    row-gap: 10px;
    column-gap: 20px;
  }

  /* LABEL */
  .label {
    font-size: 15px;
    color: #888;
    font-family: var(--mono);
    letter-spacing: 1px;
  }

  /* VALUE */
  .value {
    font-size: 15px;
    color: #222;
  }

  /* LINK */
  .value a {
    color: #2b6cb0;
    text-decoration: none;
  }

  /* FILE */
  .file-box {
    background: #fde8e4;
    padding: 10px 12px;
    border-radius: 6px;
    display: inline-block;
    font-size: 13px;
    margin: 10px 0;
  }

  /* DESCRIPTION */
  .desc {
    font-size: 13px;
    line-height: 1.6;
    color: #333;
  }

  /* DISCLAIMER */
  .disclaimer {
    margin-top: 20px;
    border: 1px solid #e6d8a8;
    background: #fffbea;
    padding: 12px;
    font-size: 11px;
    color: #6b5e2e;
    border-radius: 4px;
    font-family: var(--mono);
  }
  .modal-body {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  th {
    cursor: pointer;
    user-select: none;
  }

  .share-buttons {
    display: flex;
    gap: 40px;
    flex-wrap: wrap;
  }

  .share-btn {
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: white;
    cursor: pointer;
    font-size: 14px;
    text-decoration: none;
    color: #1f3b5b;
    font-weight: 600;
  }

  .share-btn:hover {
    background: #f3f4f6;
  }

  .share-section {
    display: flex;
    align-items: center;
    /* justify-content: space-between; */
      gap: 16px; 
    padding: 20px 0;
  }

  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .share-icons {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .icon-btn {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1.5px solid #cbd5e1;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s ease;
    padding: 0;
    text-decoration: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .icon-btn:hover {
    transform: translateY(-2px);
    border-color: #2563eb;
    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.16);
  }

  .icon-btn img {
    width: 50px;
    height: 50px;
    object-fit: contain;
  }
</style>
