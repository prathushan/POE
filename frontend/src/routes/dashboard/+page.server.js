// export const load = async ({ locals }) => {
//   console.log("LOCALS USER:", locals.user);
 
//   return {
//     user: locals. User
//   };
// };

export const load = async ({ locals, setHeaders }) => {
console.log("LOCALS USER:", locals.user); 
  // 🔥 disable cache completely
  setHeaders({
    'cache-control': 'no-store'
  });
 
  return {
    user: locals.user
  };
};