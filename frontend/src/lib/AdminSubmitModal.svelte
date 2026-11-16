<script>
  // Admin-only "Submit Exempt Solicitation" popup. Opened from the admin
  // dashboard; posts the same payload as the old /admin/submit page
  // (x-admin header) so backend behaviour is unchanged. Styled with the
  // shared design-system classes so it matches the public Submit Filing modal.
  let { open = $bindable(false) } = $props();

  // Fields (names kept identical to the old /admin/submit form).
  let company_name = $state(""); // Organization Name (submitter org)
  let company_cik = $state("");
  let contact_email = $state("");
  let contact_name = $state("");
  let memo_submitter = $state(""); // Company Name (subject company)
  let def14a_link = $state("");
  let item_number = $state("");
  let subject = $state(""); // Proposal Topic
  let file = $state(null);

  let error = $state("");
  let notice = $state("");
  let submitting = $state(false);

  function reset() {
    company_name = company_cik = contact_email = contact_name = "";
    memo_submitter = def14a_link = item_number = subject = "";
    file = null;
    error = "";
    notice = "";
  }

  function close() {
    open = false;
    reset();
  }

  async function submit() {
    error = "";
    if (!company_name || !company_cik || !contact_email || !memo_submitter || !def14a_link || !subject || !file) {
      error = "Please fill all required (*) fields and upload the proxy memo PDF.";
      return;
    }
    const link = def14a_link.startsWith("http") ? def14a_link : "https://" + def14a_link;

    const fd = new FormData();
    fd.append("company_name", company_name);
    fd.append("company_cik", company_cik);
    fd.append("contact_email", contact_email);
    fd.append("contact_name", contact_name);
    fd.append("def14a_link", link);
    fd.append("item_number", item_number);
    fd.append("subject", subject);
    fd.append("memo_submitter", memo_submitter);
    fd.append("file", file);

    submitting = true;
    try {
      const res = await fetch("/api/filings/create", {
        method: "POST",
        headers: { "x-admin": "true" },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        notice = "Exempt solicitation submitted.";
        setTimeout(() => {
          open = false;
          window.location.reload();
        }, 1400);
      } else {
        error = data.message || "Could not submit.";
      }
    } catch (e) {
      error = "Something went wrong.";
    } finally {
      submitting = false;
    }
  }
</script>

{#if open}
  <div class="modal-overlay active" onclick={close} role="presentation">
    <div class="modal submit-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>Submit Exempt Solicitation</h3>
        <button class="modal-close" onclick={close} aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        {#if notice}
          <div class="ok-banner" role="status"><span class="ok-check">✓</span><span>{notice}</span></div>
        {/if}
        {#if error}
          <div class="err-banner" role="alert">{error}</div>
        {/if}

        <div class="form-section">
          <div class="form-section-title">Submitter Information</div>
          <div class="form-section-body">
            <div class="form-grid">
              <div class="form-row">
                <label>Organization Name <span class="req">*</span></label>
                <input bind:value={company_name} placeholder="Enter organization name" />
              </div>
              <div class="form-row">
                <label>Organization CIK <span class="req">*</span></label>
                <input bind:value={company_cik} placeholder="Enter CIK" />
              </div>
            </div>
            <div class="form-grid">
              <div class="form-row">
                <label>Email <span class="req">*</span></label>
                <input bind:value={contact_email} placeholder="Enter email" />
              </div>
              <div class="form-row">
                <label>Contact Name</label>
                <input bind:value={contact_name} placeholder="Enter contact name" />
              </div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Exempt Solicitation Details</div>
          <div class="form-section-body">
            <div class="form-row">
              <label>Company Name <span class="req">*</span></label>
              <input bind:value={memo_submitter} placeholder="Enter company name" />
            </div>
            <div class="form-grid">
              <div class="form-row">
                <label>Company Proxy Statement Link (DEF 14A) <span class="req">*</span></label>
                <input bind:value={def14a_link} placeholder="SEC filing link" />
              </div>
              <div class="form-row">
                <label>Item Number</label>
                <input bind:value={item_number} placeholder="Optional item number" />
              </div>
            </div>
            <div class="form-row">
              <label>Proposal Topic <span class="req">*</span></label>
              <input bind:value={subject} placeholder="e.g., Energy &amp; Climate" />
            </div>
            <div class="form-row">
              <label>Proxy Memo (PDF) <span class="req">*</span></label>
              <label class="file-upload-zone {file ? 'has-file' : ''}">
                <div class="upload-icon">📄</div>
                <p>{file ? file.name : "Click or drag to upload the proxy memo (PDF)"}</p>
                <input type="file" accept="application/pdf" onchange={(e) => (file = e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-cancel" onclick={close}>Cancel</button>
          <button class="btn-primary" onclick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Exempt Solicitation"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .submit-modal { max-width: 760px; }
  .req { color: var(--accent); }

  .ok-banner {
    display: flex; align-items: center; gap: 10px;
    background: var(--green-light); border: 1px solid #b7e0c4; color: var(--green);
    border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px;
  }
  .ok-check {
    flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%;
    background: var(--green); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px;
  }
  .err-banner {
    background: var(--red-light); border: 1px solid #f0c7bf; color: var(--red);
    border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 13.5px; line-height: 1.4;
  }
</style>
