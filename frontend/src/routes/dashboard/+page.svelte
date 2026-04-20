<script>

  import { onMount } from "svelte";
 let { data } = $props(); // ✅ Svelte 5 way
  let user = $state(data.user); // ✅ reactive state 
  //let user = null;

  let def14a_link = "";
  let item_number = "";
  let subject = "";
  // let description = "";
  let contact_name = "";
  let contact_cik = "";
 

  let file = null;

  // ✅ NEW (safe)
  let legal_agree = false;
  let terms_agree = false;

   //   let companyName = "";
  // let companyCik = "";

  // onMount(() => {
  //   const stored = localStorage.getItem("user");
  //   if (stored) {
  //     user = JSON.parse(stored);
  //     console.log("USER:", user); // debug
  //     filer_name = user.org_name;
  //     cik = user.cik;
  //   }
  // });

  onMount(async () => {
    const stored = localStorage.getItem("user");
    if (!stored) return;

    try {
      const res = await fetch("/api/user/me", {
        headers: {
          "x-user": stored,
        },
      });

      user = await res.json();
      console.log("USER FROM API:", user);
    } catch (err) {
      console.error("USER LOAD ERROR:", err);
    }
  });

  function handleFile(e) {
    file = e.target.files[0];
  }

  async function submitFiling() {
    if (!def14a_link || !subject || !file) {
      alert("Required fields missing");
      return;
    }

    // ✅ NEW CHECK (important)
    if (!legal_agree || !terms_agree) {
      alert("Please accept both declarations before submitting");
      return;
    }

    if (!user) {
      alert("User not logged in");
      return;
    }

    const formData = new FormData();

    formData.append("def14a_link", def14a_link);
    formData.append("item_number", item_number);
    formData.append("subject", subject);
    // formData.append("description", description);
    formData.append("contact_name", contact_name);
    formData.append("file", file);
    formData.append("contact_cik", contact_cik);

    try {
      const res = await fetch("/api/filings/create", {
        method: "POST",
        headers: {
          "x-user": JSON.stringify(user),
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          "Proxy memo submitted successfully. An Admin will review the submission.",
        );

        def14a_link = "";
        item_number = "";
        subject = "";
        // description = "";
        contact_name = "";
        file = null;
        legal_agree = false;
        terms_agree = false;
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
  <title>POE | Submit Filing</title>
</svelte:head>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-logo">POE</div>

    <h2>Submit Proxy Memo</h2>

    <!-- {#if user}
      <p class="auth-sub">
        Filing as <strong>{user.org_name}</strong>
      </p>

      <div class="info-box">
        <p><strong>Company:</strong> {user.org_name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>CIK:</strong> {user.cik}</p>
      </div>
    {/if} -->


    {#if data.user}
  <p style="color:red;">
    DEBUG: {data.user.org_name} | {data.user.cik}
  </p>

  <p class="auth-sub">
    Filing as <strong>{data.user.org_name}</strong>
  </p>

  <div class="info-box">
    <p><strong>Company:</strong> {data.user.org_name}</p>
    <p><strong>Email:</strong> {data.user.email}</p>
    <p><strong>CIK:</strong> {data.user.cik}</p>
  </div>

  <label>Company Name</label>
  <input value={data.user.org_name} readonly />

  <label>Company CIK</label>
  <input value={data.user.cik} readonly />
{/if}

    <label>Company Proxy Statement Link <span class="req">*</span></label>
    <input bind:value={def14a_link} placeholder="SEC filing link" />

    <label>Item Number</label>
    <input bind:value={item_number} placeholder="Optional item number" />

    <label>Proposal Topic <span class="req">*</span></label>
    <input
      bind:value={subject}
      placeholder="circular economy, climate change, social justice…
"
    />

    <!-- <label>Description</label>
    <textarea bind:value={description} placeholder="Optional details"></textarea> -->

    <!-- <label>Company Name <span class="req">*</span></label> -->
    <!-- <input bind:value={filer_name} readonly /> -->
    <!-- <input value={user?.org_name || ""} readonly /> -->
    <!-- <input value={user?.org_name || ""} readonly /> -->

    <!-- <label>Company CIK Number <span class="req">*</span></label> -->
    <!-- <input bind:value={cik} readonly /> -->
    <!-- <input value={user?.cik || ""} readonly /> -->
    <!-- <input value={user?.cik || ""} readonly /> -->
<!-- {#key user}
<label>Company Name</label>
<input value={user?.org_name || ""} readonly />
 
  <label>Company CIK</label>
<input value={user?.cik || ""} readonly />
{/key} -->


    
    <!-- <p>{JSON.stringify(user)}</p>
    <p style="color:red;">DEBUG: {user?.org_name} | {user?.cik}</p> -->

    <label>Submission Contact Name</label>
    <input bind:value={contact_name} placeholder="Optional override" />

    <!-- <label>Contact CIK</label>
    <input bind:value={contact_cik} placeholder="Optional contact CIK" /> -->

    <label>Upload Proxy Memo PDF <span class="req">*</span></label>
    <input type="file" on:change={handleFile} />

    <!-- ✅ CHECKBOXES (SAFE TEXT, NO BREAKING CHARACTERS) -->
    <div class="checkbox-group">
      <label class="checkbox-row">
        <input type="checkbox" bind:checked={legal_agree} />
        <span>
          Filer confirms they do not beneficially own more than $5 million of
          the subject securities and are submitting voluntarily.
        </span>
      </label>

      <label class="checkbox-row">
        <input type="checkbox" bind:checked={terms_agree} />
        <span>
          I certify the information is accurate and acknowledge the Terms of
          Use.
        </span>
      </label>
    </div>

    <!-- <button class="btn-auth" on:click={submitFiling}>
      Submit Proxy Memo
    </button> -->

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

  /* Align with other form fields */
  .checkbox-row {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: start;
    column-gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    cursor: pointer;
  }

  /* Clean checkbox alignment */
  .checkbox-row input {
    margin-top: 3px;
  }

  /* Make text align perfectly */
  .checkbox-row span {
    display: block;
  }
</style>
