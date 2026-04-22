

<script>
  import { onMount } from "svelte";

  // 🔥 Admin enters EVERYTHING manually
  let company_name = "";
  let company_cik = "";
  let contact_email = "";
  let contact_name = "";

  let def14a_link = "";
  let item_number = "";
  let subject = "";
  let memo_submitter = "";

  let file = null;

  let legal_agree = false;
  let terms_agree = false;

  function handleFile(e) {
    file = e.target.files[0];
  }

  async function submitFiling() {
    if (!company_name || !company_cik || !contact_email || !def14a_link || !subject || !file) {
      alert("Required fields missing");
      return;
    }

    // 🔥 Fix link
    if (def14a_link && !def14a_link.startsWith("http")) {
      def14a_link = "https://" + def14a_link;
    }

    // if (!legal_agree || !terms_agree) {
    //   alert("Please accept both declarations");
    //   return;
    // }

    const formData = new FormData();

    formData.append("company_name", company_name);
    formData.append("company_cik", company_cik);
    formData.append("contact_email", contact_email);
    formData.append("contact_name", contact_name);

    formData.append("def14a_link", def14a_link);
    formData.append("item_number", item_number);
    formData.append("subject", subject);
    formData.append("memo_submitter", memo_submitter);
    formData.append("file", file);

    try {
      const res = await fetch("/api/filings/create", {
        method: "POST",
        headers: {
          "x-admin": "true" // 🔥 IMPORTANT
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert("Proxy memo submitted successfully");

        window.location.reload();
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  }
</script>

<svelte:head>
  <title>POE | Admin Submit Filing</title>
</svelte:head>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-logo">POE</div>

    <h2>Admin Submit Proxy Memo</h2>

    <!-- 🔥 ADMIN FIELDS -->
    <label>Organization Name <span class="req">*</span></label>
    <input bind:value={company_name} placeholder="Enter Organization Name" />

    <label>Organization CIK <span class="req">*</span></label>
    <input bind:value={company_cik} placeholder="Enter CIK" />

    <label>Email <span class="req">*</span></label>
    <input bind:value={contact_email} placeholder="Enter Email" />

    <label>Contact Name</label>
    <input bind:value={contact_name} placeholder="Enter Contact Name" />

    <!-- EXISTING FIELDS -->
    <label>Company Name <span class="req">*</span></label>
    <input bind:value={memo_submitter} placeholder="Enter Company Name" />

    <label>Company Proxy Statement Link (DEF14A) <span class="req">*</span></label>
    <input bind:value={def14a_link} placeholder="SEC filing link" />

    <label>Item Number</label>
    <input bind:value={item_number} placeholder="Optional item number" />

    <label>Proposal Topic <span class="req">*</span></label>
    <input bind:value={subject} placeholder="Proposal topic" />

    <label>Upload Proxy Memo PDF <span class="req">*</span></label>
    <input type="file" on:change={handleFile} />

    <!-- CHECKBOXES -->
    <!-- <div class="checkbox-group">
      <label class="checkbox-row">
        <input type="checkbox" bind:checked={legal_agree} />
        <span>
          Filer confirms they do not beneficially own more than $5 million of the subject securities.
        </span>
      </label>

      <label class="checkbox-row">
        <input type="checkbox" bind:checked={terms_agree} />
        <span>
          I certify the information is accurate and acknowledge the
          <a href="/terms" class="terms-link">Terms of Use</a>.
        </span>
      </label>
    </div> -->

    <button class="btn-auth" on:click={submitFiling}>
      Submit Proxy Memo
    </button>
  </div>
</div>

<style>
  .req {
    color: red;
  }

  .checkbox-group {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .checkbox-row {
    display: grid;
    grid-template-columns: 18px 1fr;
    column-gap: 8px;
    font-size: 13px;
  }
</style>
