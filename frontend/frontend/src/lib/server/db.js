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
 
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
 
export default pool;