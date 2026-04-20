import { json } from '@sveltejs/kit';
 
export const GET = async ({ request }) => {
  try {
    const userHeader = request.headers.get('x-user');
 
    if (!userHeader) return json(null);
 
    const user = JSON.parse(userHeader);
 
    return json(user);
 
  } catch (err) {
    console.log("USER ME ERROR:", err);
    return json(null);
  }
};