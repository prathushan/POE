<script>
  let { data } = $props();

  const filing = data.filing;
</script>

<!-- <svelte:head>
  <title>{filing.subject}</title>

  <meta property="og:title" content={filing.subject} />

  <meta
    property="og:description"
    content={`Proxy memo submitted by ${filing.company_name}`}
  />

  <meta
    property="og:url"
    content={`https://proxyopenexchange.org/filing/${filing.id}`}
  />

  <meta property="og:type" content="website" />
</svelte:head> -->
<svelte:head>
  <title>{filing.subject}</title>

  <meta property="og:title" content={filing.subject} />

  <meta
    property="og:description"
    content={`Proxy memo submitted by ${filing.company_name}`}
  />

  <meta
    property="og:url"
    content={`https://proxyopenexchange.org/filing/${filing.id}`}
  />

  <!-- ADD THIS -->
  <meta
    property="og:image"
    content="https://proxyopenexchange.org/poe-share-image.png"
  />

  <!-- OPTIONAL BUT RECOMMENDED -->
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
<!-- <div class="filing-page">
  <h1>{filing.subject}</h1>

  <p>
    <strong>Company Name:</strong>
    {filing.memo_submitter}
  </p>

  <p>
    <strong>DEF 14A Filing:</strong>

    <a
      href={filing.def14a_link?.startsWith("http")
        ? filing.def14a_link
        : "https://" + filing.def14a_link}
      target="_blank"
      rel="noopener noreferrer"
    >
      {filing.def14a_link}
    </a>
  </p>

  <p>
    <strong>Proposal Submitted By:</strong>
    {filing.company_name}
  </p>

  <p>
    <strong>Contact:</strong>
    {filing.contact_name || "-"}
  </p>

  {#if filing.pdf_s3_key}
    <p>
      <a
        href={`/${filing.pdf_s3_key.replace("static/", "")}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        📄 View Proxy Memo PDF
      </a>
    </p>
  {/if}
</div> -->
<div class="filing-page">
  <div class="modal-body">
    <!-- TITLE -->
    <h2 class="modal-title">
      Proxy Memo — {filing.subject}
    </h2>

    <!-- META -->
    <p class="meta">
      Filed {new Date(filing.created_at).toLocaleDateString()}
    </p>

    <hr />

    <!-- FILING INFO -->
    <h4 class="section-title">PROXY INFORMATION</h4>

    <div class="info-grid">
      <div class="label">COMPANY NAME</div>
      <div class="value">{filing.memo_submitter}</div>

      <div class="label">DEF 14A FILING</div>

      <div class="value">
        <a
          href={filing.def14a_link?.startsWith("http")
            ? filing.def14a_link
            : "https://" + filing.def14a_link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {filing.def14a_link}
        </a>
      </div>

      <div class="label">PROPOSAL ITEM</div>
      <div class="value">{filing.item_number || "-"}</div>

      <div class="label">ORGANIZATION NAME</div>
      <div class="value">{filing.company_name}</div>

      <div class="label">ORGANIZATION CIK</div>
      <div class="value">{filing.company_cik || "-"}</div>

      <div class="label">CONTACT</div>

      <div class="value">
        {filing.contact_name || "-"} ·
        {filing.contact_email || "-"}
      </div>
    </div>

    <hr />

    <!-- FILE -->
    <h4 class="section-title">WRITTEN MATERIALS</h4>

    {#if filing.pdf_s3_key}
      <div class="file-box">
        📄

        <a
          href={`/${filing.pdf_s3_key.replace("static/", "")}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {filing.pdf_filename}
        </a>
      </div>
    {/if}

    <hr />

    <!-- DISCLAIMER -->
    <div class="disclaimer">
      THIS INFORMATION SHOULD NOT BE CONSTRUED AS INVESTMENT ADVICE OR
      AS A SOLICITATION OF AUTHORITY TO VOTE YOUR PROXY.
    </div>
  </div>
</div>
<style id="oh8x4v">
  .filing-page {
    max-width: 900px;
    margin: 40px auto;
    padding: 20px;
  }

  p {
    margin-bottom: 20px;
  }

  h1 {
    margin-bottom: 30px;
  }

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
</style>
