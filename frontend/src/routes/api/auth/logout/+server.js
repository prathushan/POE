// import { json } from '@sveltejs/kit';
 
// export const POST = async ({ cookies }) => {
//   cookies.delete('user', { path: '/' });
 
//   return json({ success: true });
// };

import { json } from '@sveltejs/kit';
 
export const POST = async ({ cookies }) => {
  // Must match the attributes the login cookie was set with (secure:false,
  // httpOnly, sameSite:lax, path:/). Without secure:false, SvelteKit defaults
  // the clear-cookie to Secure, which browsers reject over HTTP (staging) — so the
  // cookie never cleared and the user stayed "logged in".
  cookies.set('user', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    expires: new Date(0)
  });

  return json({ success: true });
};