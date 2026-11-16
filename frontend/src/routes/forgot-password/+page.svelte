<script>
  let email = $state("");
  let message = $state("");
  let sent = $state(false);
  let busy = $state(false);
  let devUrl = $state("");

  async function submit() {
    if (!email) {
      message = "Please enter your email.";
      return;
    }
    busy = true;
    message = "";
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        sent = true;
        message = data.message;
        if (data.devResetUrl) devUrl = data.devResetUrl; // dev-only convenience
      } else {
        message = data.message || "Something went wrong.";
      }
    } catch {
      message = "Something went wrong.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>POE | Forgot Password</title>
</svelte:head>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-logo">POE</div>
    <h2>Reset your password</h2>
    <p class="auth-sub">Enter your account email and we'll send you a reset link.</p>

    {#if sent}
      <p class="auth-msg ok">{message}</p>
      {#if devUrl}
        <p class="dev-link">
          Dev link (email not configured yet):<br />
          <a href={devUrl}>{devUrl}</a>
        </p>
      {/if}
    {:else}
      <label>Email</label>
      <input bind:value={email} placeholder="your@organization.org" />
      {#if message}<p class="auth-msg err">{message}</p>{/if}
      <button class="btn-auth" disabled={busy} on:click={submit}>
        {busy ? "Sending…" : "SEND RESET LINK"}
      </button>
    {/if}

    <p class="auth-footer"><a href="/login">← Back to sign in</a></p>
  </div>
</div>

<style>
  .auth-msg { font-size: 13.5px; margin: 10px 0; line-height: 1.5; }
  .auth-msg.ok { color: #2f855a; }
  .auth-msg.err { color: #c53030; }
  .dev-link {
    font-size: 12px; color: #6b7585; background: #f3efe9; border: 1px dashed #d7d0c4;
    border-radius: 6px; padding: 10px; margin: 8px 0; word-break: break-all;
  }
  .dev-link a { color: #1f3b5b; }
</style>
