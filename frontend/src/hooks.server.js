// export async function handle({ event, resolve }) {
//   const cookie = event.cookies.get('user');
 
//   if (cookie) {
//     try {
//       event.locals.user = JSON.parse(cookie);
//     } catch {
//       event.locals.user = null;
//     }
//   } else {
//     event.locals.user = null;
//   }
 
//   return resolve(event);
//}

export async function handle({ event, resolve }) {
  const cookie = event.cookies.get('user');
 
  console.log("HOOK COOKIE:", cookie); // 🔍 debug
 
  if (cookie) {
    try {
      event.locals.user = JSON.parse(cookie);
    } catch (e) {
      console.log("PARSE ERROR:", e);
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }
 
  return resolve(event);
}