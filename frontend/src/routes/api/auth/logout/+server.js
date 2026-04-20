// import { json } from '@sveltejs/kit';
 
// export const POST = async ({ cookies }) => {
//   cookies.delete('user', { path: '/' });
 
//   return json({ success: true });
// };

import { json } from '@sveltejs/kit';
 
export const POST = async ({ cookies }) => {
  cookies.set('user', '', {
    path: '/',
    expires: new Date(0) // 🔥 THIS IS IMPORTANT
  });
 
  return json({ success: true });
};