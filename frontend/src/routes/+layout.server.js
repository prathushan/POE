export const load = async ({ locals }) => {


  
  return {

    user: locals.user || null

  };

};
 
export const prerender = false; // important
