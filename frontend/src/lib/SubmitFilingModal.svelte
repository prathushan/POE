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
  let meeting_date = $state("");
  let meeting_date_known = $state(false);
  let proposal_text = $state("");
  let proxy_status = $state("");

  // ── Company typeahead (New Proposal) ──
  let companies = $state([]);
  let companiesLoaded = false;
  let showCompanyDd = $state(false);
  let companyResults = $derived(
    company_name.trim().length >= 2
      ? companies
          .filter((c) => c.company_name.toLowerCase().includes(company_name.toLowerCase()))
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
  function suggestAgm(d) {
    if (!d) return "";
    const dt = new Date(d);
    dt.setFullYear(dt.getFullYear() + 1);
    return dt.toISOString().slice(0, 10);
  }
  function pickCompany(c) {
    company_name = c.company_name;
    registrant_cik = c.company_cik || "";
    if (c.meeting_date) {
      meeting_date = suggestAgm(c.meeting_date);
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

  // ── No-action ──
  let exclusion_bases = $state([]);
  function toggleBasis(b) {
    exclusion_bases = exclusion_bases.includes(b)
      ? exclusion_bases.filter((x) => x !== b)
      : [...exclusion_bases, b];
  }
  let notice_date = $state("");

  // ── Exempt / standalone ──
  let def14a_link = $state("");
  let item_number = $state("");
  let voluntary_5m = $state(false);

  // ── Standalone (legacy) extra ──
  let std_company = $state("");
  let std_topic = $state("");
  let std_contact = $state("");
  let std_5m_ack = $state(false);

  // ── Files ──
  let primary_file = $state(null);
  let second_file = $state(null);

  let certify = $state(false);
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
  }

  function resetFields() {
    company_name = registrant_cik = proposal_topic = proposal_topic_other = "";
    meeting_date = ""; meeting_date_known = false; proposal_text = ""; proxy_status = "";
    parent_proposal_id = ""; proposalSearch = "";
    exclusion_bases = []; notice_date = "";
    def14a_link = ""; item_number = ""; voluntary_5m = false;
    std_company = ""; std_topic = ""; std_contact = ""; std_5m_ack = false;
    primary_file = null; second_file = null; certify = false;
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
  }

  // Proxy Preview 2027 contribution link. As You Sow will supply the destination
  // URL before launch (scope appendix Q6). Leave "" until provided — the message
  // still renders, with the link shown as "coming soon".
  const PROXY_PREVIEW_URL = "";

  let confirmOpen = $state(false);
  // which success message to show in the styled confirmation popup
  let successKind = $state("proposal"); // "proposal" | "standalone"
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
      fd.append("primary_file", primary_file);
    } else if (mode === "no_action") {
      if (!parent_proposal_id || exclusion_bases.length === 0 || !notice_date) {
        alert("Please select a proposal, an exclusion basis, and a notice date."); return;
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
      fd.append("primary_file", primary_file);
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
      const res = await fetch("/api/filings/create", {
        method: "POST",
        headers: { "x-user": JSON.stringify(user) },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        if (mode === "new") {
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
          // Inline, company-named confirmation (no popup) — scope §5.
          const company = selectedProposal?.company_name || "the proposal";
          const label = mode === "no_action" ? "No-action notice" : "Exempt solicitation";
          attachNotice = `${label} attached to ${company}. Live immediately — no admin approval required.`;
          setTimeout(() => {
            close();
            window.location.reload();
          }, 2600);
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
        <!-- SUBMISSION MODE -->
        <div class="form-section">
          <div class="form-section-title">Submission Mode</div>
          <div class="form-section-body">
            <div class="form-row">
              <label>What would you like to do? <span class="req">*</span></label>
              <select bind:value={mode} onchange={onModeChange}>
                <option value="">— Select —</option>
                <option value="new">File a new shareholder proposal</option>
                <option value="no_action">Attach a no-action / exclusion notice to one of my proposals</option>
                <option value="exempt">Attach an exempt solicitation to one of my proposals</option>
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

        <!-- ══════ NEW PROPOSAL ══════ -->
        {#if mode === "new"}
          <div class="form-section">
            <div class="form-section-title">Company Information</div>
            <div class="form-section-body">
              <div class="form-grid">
                <div class="form-row">
                  <label>Company Name <span class="req">*</span></label>
                  <div class="proposal-selector">
                    <input
                      bind:value={company_name}
                      oninput={() => { showCompanyDd = true; lookupEdgar(company_name); }}
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
                            <small>CIK {c.company_cik}{#if c.meeting_date} · last mtg {fmtDate(c.meeting_date)}{/if}</small>
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
                  <input type="date" bind:value={meeting_date} />
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
                <label>Supporting Document <span class="req">*</span></label>
                <label class="file-upload-zone {primary_file ? 'has-file' : ''}">
                  <div class="upload-icon">📄</div>
                  <p>{primary_file ? primary_file.name : "Click or drag to upload the full resolution (PDF)"}</p>
                  <input type="file" accept="application/pdf" onchange={(e) => (primary_file = e.target.files[0])} />
                </label>
                <div class="helper">Upload the complete shareholder resolution document. This is the primary filing record on POE.</div>
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
              <div class="form-row">
                <label>Exclusion Basis <span class="req">*</span> <span class="optional">(select all that apply)</span></label>
                <div class="basis-list">
                  {#each EXCLUSION_BASES as b}
                    <label class="basis-item">
                      <input type="checkbox" checked={exclusion_bases.includes(b)} onchange={() => toggleBasis(b)} />
                      <span class="basis-text">
                        {#if b.includes(" — ")}<strong>{b.split(" — ")[0]}</strong> — {b.split(" — ").slice(1).join(" — ")}{:else}<strong>{b}</strong>{/if}
                      </span>
                    </label>
                  {/each}
                </div>
              </div>

              <div class="form-row" style="max-width: 280px;">
                <label>No-Action Notice Date <span class="req">*</span></label>
                <input type="date" bind:value={notice_date} />
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
        {#if mode === "new" || mode === "no_action" || mode === "exempt"}
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
              <div class="helper">This information is pulled from your POE account registration. To update, visit your account settings.</div>
            </div>
          </div>
        {/if}

        <!-- CERTIFICATION -->
        {#if mode}
          <div class="form-section">
            <div class="form-section-title">Certification</div>
            <div class="form-section-body">
              <label class="checkbox-row">
                <input type="checkbox" bind:checked={certify} />
                <span>I certify that the information provided is true and accurate to the best of my knowledge, and I am authorized to submit this filing on behalf of the named filer.</span>
              </label>
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="form-actions">
            <button class="btn-cancel" onclick={close}>Cancel</button>
            <button class="btn-primary" onclick={submitFiling} disabled={!mode || submitting}>
              {submitting ? "Submitting…" : "Submit Filing"}
            </button>
          </div>
        {:else}
          <div class="form-actions">
            <button class="btn-cancel" onclick={close}>Cancel</button>
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
      <h3>{successKind === "standalone" ? "Filing Submitted Successfully" : "Proposal Submitted Successfully"}</h3>
      <div class="confirm-msg">
        {#if successKind === "standalone"}
          <p>Your <strong>exempt solicitation has been submitted</strong> and is pending admin review.</p>
        {:else}
          <p><strong>Your shareholder proposal has been submitted</strong> and is pending admin review.</p>
          <p class="cm-line"><span class="cm-dot">●</span> <strong>Be sure to return to update your resolution</strong> once you know if it has been included, excluded, or withdrawn on the proxy statement.</p>
          <p class="cm-line"><span class="cm-dot">●</span> If you have an interest in submitting an article to be possibly included in <strong>Proxy Preview 2027</strong> please review the {#if PROXY_PREVIEW_URL}<a href={PROXY_PREVIEW_URL} target="_blank" rel="noopener noreferrer">contribution instructions</a>{:else}<span class="cf-link-soon">contribution instructions</span>{/if}.</p>
        {/if}
      </div>
      <button class="btn-primary confirm-done" onclick={closeConfirm}>Done</button>
    </div>
  </div>
{/if}

{#snippet linkToProposal()}
  <div class="form-section">
    <div class="form-section-title">Link to Proposal</div>
    <div class="form-section-body">
      <div class="form-row">
        <label>Select Your Proposal <span class="req">*</span></label>
        <input bind:value={proposalSearch} oninput={() => (parent_proposal_id = "")} placeholder="Type to search your proposals..." />
        <div class="helper">Only shows your own approved proposals. Search by company name or topic.</div>

        {#if parent_proposal_id}
          <p class="selected-note">✓ Selected: {proposalSearch}</p>
        {:else if myProposals.length === 0}
          <div class="helper muted">No approved proposals found on your account yet. A proposal must be approved before you can attach to it.</div>
        {:else if filteredProposals.length === 0}
          <div class="helper muted">No proposals match your search.</div>
        {:else}
          <div class="proposal-list">
            {#each filteredProposals as p}
              <button type="button" class="prop-item" onclick={() => pickProposal(p)}>
                <strong>{p.company_name}</strong>
                <small>{p.proposal_topic ?? "—"}{#if p.created_at} · Filed {fmtDate(p.created_at)}{/if}</small>
              </button>
            {/each}
          </div>
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
  /* The submit modal follows the prototype at 820px; shell + form skeleton
     (.modal-overlay/.modal/.modal-header/.form-section/.form-row/.form-grid/
     .btn-cancel/.btn-primary/.file-upload-zone/.checkbox-row/.date-kind/
     .proposal-selector/.proposal-dropdown/.inherited-field) come from app.css
     so they match the design system exactly. Only the extras live here. */
  .submit-modal { max-width: 820px; }

  .form-section-title .auto {
    text-transform: none; letter-spacing: 0; color: var(--g4); font-weight: 400;
  }

  .req { color: var(--accent); }
  /* "(Optional)" sits inside the uppercase mono field label — inherit case/spacing like the prototype, just lighter */
  .optional { color: var(--g4); font-weight: 400; }
  .helper.muted { color: var(--accent); }
  .selected-note { color: var(--green); font-size: 12.5px; font-weight: 600; margin: 8px 0 0; font-family: var(--sans); }

  /* readonly / inherited inputs */
  input[readonly] { background: var(--paper-warm); color: var(--g5); }
  input[readonly]:focus { box-shadow: none; border-color: var(--g2); }

  /* inline proposal results list (reuses prototype .prop-item look) */
  .proposal-list {
    margin: 10px 0 0; border: 1px solid var(--g2); border-radius: 4px;
    max-height: 180px; overflow-y: auto; background: #fff;
  }
  .proposal-list .prop-item {
    display: block; width: 100%; text-align: left; cursor: pointer;
    padding: 10px 14px; font-size: 13px; font-family: var(--sans);
    background: none; border: none; border-bottom: 1px solid var(--g1);
  }
  .proposal-list .prop-item:last-child { border-bottom: none; }
  .proposal-list .prop-item:hover { background: var(--paper); }
  .proposal-list .prop-item strong { color: var(--blue); display: block; margin-bottom: 2px; }
  .proposal-list .prop-item small { color: var(--g4); font-family: var(--mono); font-size: 11px; }

  /* no-action multi exclusion-basis checkbox grid */
  .basis-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 26px; margin-top: 4px; }
  .basis-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 13px; line-height: 1.4; color: var(--g5); cursor: pointer;
    text-transform: none; letter-spacing: 0; font-weight: 400; font-family: var(--sans); margin: 0;
  }
  .basis-item input[type="checkbox"] {
    appearance: none; -webkit-appearance: none; flex: 0 0 auto;
    width: 16px; height: 16px; margin: 1px 0 0; border: 1.5px solid var(--g3);
    border-radius: 4px; background: #fff; cursor: pointer; position: relative;
  }
  .basis-item input[type="checkbox"]:checked { background: var(--blue); border-color: var(--blue); }
  .basis-item input[type="checkbox"]:checked::after {
    content: "✓"; color: #fff; font-size: 11px; line-height: 1; font-weight: 700;
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  }
  .basis-text strong { color: var(--blue); font-weight: 700; }
  @media (max-width: 620px) { .basis-list { grid-template-columns: 1fr; } }

  /* inline attach-success banner */
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
