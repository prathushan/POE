// import mysql from 'mysql2/promise';

// export const db = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'poe'
// });




// import pkg from 'pg';
// const { Pool } = pkg;

// const pool = new Pool({
//   user: 'prathushanammi',
//   host: 'localhost',
//   database: 'poe',
//   password: '', // leave empty if no password
//   port: 5433, // IMPORTANT
// });

// export default pool;

import pkg from 'pg';
const { Pool } = pkg;
 
import { DATABASE_URL } from '$env/static/private';
 
// Local dev connects to a localhost Postgres (no SSL); production RDS requires SSL.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});
 
export default pool;