<!-- <script>
  let email = $state('');
  let password = $state('');

  async function login() {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    window.location.href = '/dashboard';
  }
</script> -->
<script>
import { goto } from '$app/navigation';
  let email = $state('');
  let password = $state('');
  let message = $state('');

  // async function login() {
  //   const res = await fetch('/api/auth/login', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ email, password })
  //   });

  //   const data = await res.json();

  //   if (data.success) {
  //     // ✅ store FULL user
  //     localStorage.setItem('user', JSON.stringify(data.user));

  //     message = 'Login successful! Redirecting...';

  //     setTimeout(() => {
  //       window.location.href = '/dashboard';
  //     }, 1000);
  //   } else {
  //     message = data.message;
  //   }
  // }


async function login() {

  if (!email || !password) {

    message = "Please enter email and password";

    return;

  }
 
  try {

    const res = await fetch('/api/auth/login', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      credentials: 'include',

      body: JSON.stringify({ email, password })

    });
 
    const data = await res.json();
 
    if (res.ok && data.success) {

      message = 'Login successful! Redirecting...';
 
      // 🔥 THIS LINE FIXES YOUR ISSUE

      window.location.href = '/dashboard';
 
    } else {

      message = data.message || "Login failed";

    }
 
  } catch (err) {

    console.error(err);

    message = "Something went wrong";

  }

}
 
 
</script>

<svelte:head>
  <title>POE | Login</title>
</svelte:head>
<div class="auth-wrapper">
  <div class="auth-card">

    <div class="auth-logo">POE</div>

    <h2>Sign In</h2>
    <p class="auth-sub">Sign in to submit a filing</p>

    <label>Email</label>
    <input bind:value={email} placeholder="your@organization.org" />

    <label>Password</label>
    <input type="password" bind:value={password} placeholder="Password" />

    <p class="auth-forgot"><a href="/forgot-password">Forgot password?</a></p>

    {#if message}
      <p class="auth-msg {message.toLowerCase().includes('success') ? 'ok' : 'err'}" role="alert">{message}</p>
    {/if}

    <button class="btn-auth" on:click={login}>SIGN IN</button>

    <p class="auth-footer">
      Don't have an account?
      <a href="/signup">Create one</a>
    </p>

  </div>
</div>

<style>
  .auth-forgot { text-align: right; margin: 8px 0 4px; font-size: 13px; }
  .auth-forgot a { color: #1f3b5b; text-decoration: none; }
  .auth-forgot a:hover { text-decoration: underline; }
  .auth-msg { font-size: 13px; padding: 9px 12px; border-radius: 6px; margin: 4px 0 10px; line-height: 1.4; }
  .auth-msg.err { background: #fde8e4; color: #b23b32; border: 1px solid #f0c7bf; }
  .auth-msg.ok { background: #e6f4ea; color: #15803d; border: 1px solid #b7e0c4; }
</style>