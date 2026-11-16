<script>
  import { page } from "$app/stores";

  let password = $state("");
  let confirm = $state("");
  let message = $state("");
  let done = $state(false);
  let busy = $state(false);

  let token = $derived($page.url.searchParams.get("token") || "");

  async function submit() {
    if (!token) {
      message = "This reset link is missing its token.";
      return;
    }
    if (password.length < 6) {
      message = "Password must be at least 6 characters.";
      return;
    }
    if (password !== confirm) {
      message = "Passwords do not match.";
      return;
    }
    busy = true;
    message = "";
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        done = true;
        message = data.message;
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
  <title>POE | Set New Password</title>
</svelte:head>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-logo">POE</div>
    <h2>Set a new password</h2>

    {#if done}
      <p class="auth-msg ok">{message}</p>
      <a class="btn-auth" href="/login" style="display:block;text-align:center;text-decoration:none;">GO TO SIGN IN</a>
    {:else if !token}
      <p class="auth-msg err">This reset link is invalid. Please request a new one.</p>
      <p class="auth-footer"><a href="/forgot-password">Request a new link</a></p>
    {:else}
      <p class="auth-sub">Choose a new password for your account.</p>
      <label>New password</label>
      <input type="password" bind:value={password} placeholder="At least 6 characters" />
      <label>Confirm new password</label>
      <input type="password" bind:value={confirm} placeholder="Re-enter password" />
      {#if message}<p class="auth-msg err">{message}</p>{/if}
      <button class="btn-auth" disabled={busy} on:click={submit}>
        {busy ? "Saving…" : "RESET PASSWORD"}
      </button>
      <p class="auth-footer"><a href="/login">← Back to sign in</a></p>
    {/if}
  </div>
</div>

<style>
  .auth-msg { font-size: 13.5px; margin: 10px 0; line-height: 1.5; }
  .auth-msg.ok { color: #2f855a; }
  .auth-msg.err { color: #c53030; }
</style>
