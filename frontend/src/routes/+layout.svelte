<script>
  import '../app.css';
</script>
<svelte:head>
  <title>POE | Proxy Open Exchange</title>

  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <meta name="theme-color" content="#000000" />
</svelte:head>
<!-- TOP BAR -->
<!-- <div class="top-bar">
  <div class="container">
    <span>POE — Public Proxy Filing System</span>
    <div class="top-links">
      <a href="/about">About POE</a>
     <a href="/terms">Terms</a>
      <a href="/login">Sign In</a>
    </div>
  </div>
</div> -->

<!-- HEADER -->
<header>
  <div class="container header-main">
    <div class="logo-group">
      <div class="logo-seal">POE</div>
      <div class="logo-text">
        <h1>Proxy Open Exchange</h1>
        <p>Shareholder Proxy Memo Publishing Platform</p>
      </div>
    </div>

    <nav class="header-nav">
      <a href="/">Home</a>
      <!-- <a href="/filings">Filings</a> -->
      <a href="/about">About</a>
      <a href="/login">Submit Proxy Memo</a>
      <a href="/login">Sign In </a>
      <a href="/signup">Sign Up</a>
    </nav>
  </div>
</header>



<!-- SUBMIT BAR -->
<div class="submit-bar">
  <div class="container submit-bar-inner">
    <a href="/login">
  <button class="btn-cta">Submit Exempt Solicitation →</button>
</a>
    <div class="submit-bar-text">
      Publish your exempt solicitation to the public record.
      <a href="/about">Why POE?</a>
    </div>
  </div>
</div>

<slot />

<!-- FOOTER -->
<footer>
  <div class="container">

    <div class="footer-grid">

      <!-- LEFT -->
      <div class="footer-brand">
        <h4>Proxy Open Exchange</h4>
        <p>
          An open, community-driven platform for publishing shareholder exempt solicitations.
          Created in response to the SEC's revised Question 126.06 to ensure continued transparency
          in corporate governance.
        </p>
      </div>

      <!-- NAV -->
      <div>
        <h5>Navigate</h5>
        <ul>
          <li><a href="/">Browse Proxy Memos</a></li>
          <li><a href="/login">Submit Proxy Memo</a></li>
          <li><a href="/about">About POE</a></li>
          <li><a href="/terms">Terms of Use</a></li>
        </ul>
      </div>

      <!-- RESOURCES -->
<div>
  <h5>Resources</h5>
  <ul>
    <li>
      <a 
        href="https://www.sec.gov/about/divisions-offices/division-corporation-finance/proxy-rules-schedules-14a14c-notice-012725" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        C&DI Q126.06 — SEC Rule Change
      </a>
    </li>

    <li>
      <a 
        href="https://www.sec.gov/submit-filings/forms-index/aboutformsformidpdf" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        Register for a CIK Number
      </a>
    </li>

    <li>
      <a href="/about">
        About POE & Why It Exists
      </a>
    </li>

    <li>
      <a href="/admin/login" class="admin-link">
        Admin Portal
      </a>
    </li>
  </ul>
</div>

    </div>

    <div class="footer-bottom">
      <span>© 2026 Proxy Open Exchange</span>
      <span>All Proxy memos published under CC BY 4.0</span>
    </div>

  </div>
</footer>