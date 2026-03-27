<script>
  import { goto } from '$app/navigation';

  let filer_name = $state('');
  let cik = $state('');
  let email = $state('');
  let contact_name = $state('');
  let password = $state('');
  let org_name = $state('');
  let message = $state('');

  // ✅ Toast state
  let showToast = $state(false);

  async function checkCIK() {
    if (cik.length < 5) return;

    const res = await fetch(`/api/cik?cik=${cik}`);
    const data = await res.json();

    if (data.found) {
      org_name = data.org_name;
      filer_name = data.org_name;
    } else {
      org_name = '';
    }
  }

  async function signup() {
    if (!filer_name || !email || !password || !cik || !contact_name) {
      message = 'All fields are required';
      return;
    }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        cik,
        filer_name,
        contact_name
      })
    });

    const data = await res.json();

    if (data.success) {
      // ✅ Save user
      localStorage.setItem('user', JSON.stringify({
        email,
        org_name: data.org_name
      }));

      // ✅ Show toast instead of banner
      showToast = true;
      message = '';

      // ✅ Redirect after delay
      setTimeout(() => {
        goto('/');
      }, 2500);
    } else {
      message = data.message;
    }
  }
</script>

<div class="auth-wrapper">
  <div class="auth-card">

    <!-- ✅ TOAST -->
    {#if showToast}
      <div class="toast">
        <span>
          Your filing has been submitted. Once our staff accepts it, you will be notified.
        </span>
        <button on:click={() => showToast = false}>✕</button>
      </div>
    {/if}

    <div class="auth-logo">POE</div>

    <h2>Create Account</h2>
    <p class="auth-sub">
      Register your organization to submit exempt solicitations on the Proxy Open Exchange.
    </p>

    <!-- 🔴 ERROR MESSAGE -->
    {#if message}
      <div class="error-banner">
        {message}
      </div>
    {/if}

    <label>Filer Name <span class="req">*</span></label>
    <input bind:value={filer_name} placeholder="i.e., Organization or Shareholder Name/Entity" />

    <label>Filer CIK Number <span class="req">*</span></label>
    <input bind:value={cik} on:input={checkCIK} placeholder="10-digit Central Index Key" />

    <div class="helper-links">
      <a href="https://www.sec.gov/search-filings/cik-lookup" target="_blank">
        Look up your CIK on SEC EDGAR →
      </a>
      <a href="https://www.sec.gov/submit-filings/forms-index/aboutformsformidpdf" target="_blank">
        Don't have a CIK? Register here →
      </a>
    </div>

    <label>Organization Email <span class="req">*</span></label>
    <input bind:value={email} placeholder="e.g., name@organization.org" />

    <small class="note">
      Must match your organization's email domain. Consumer emails are not accepted.
    </small>

    <div class="row">
      <div>
        <label>Contact Name <span class="req">*</span></label>
        <input bind:value={contact_name} placeholder="Full name" />
      </div>

      <div>
        <label>Password <span class="req">*</span></label>
        <input type="password" bind:value={password} placeholder="Min. 8 characters" />
      </div>
    </div>

    <button class="btn-auth" on:click={signup}>
      CREATE ACCOUNT
    </button>

    <p class="auth-footer">
      Already have an account?
      <a href="#" on:click={() => goto('/login')}>Sign in</a>
    </p>

  </div>
</div>

<style>
.req {
  color: red;
}

.error-banner {
  background: #f8d7da;
  color: #842029;
  padding: 10px;
  border-radius: 6px;
  margin: 10px 0 15px 0;
  text-align: center;
  font-size: 14px;
}

/* ✅ TOAST STYLE */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #d6a3a3;
  color: #000;
  padding: 14px 18px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 350px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  animation: slideIn 0.3s ease;
}

.toast button {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}

/* ✨ Optional animation */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(40px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>