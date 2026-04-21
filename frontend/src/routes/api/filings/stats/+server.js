

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const GET = async () => {
  try {
    // const result = await pool.query(`
    //   SELECT 
    //     COUNT(*) as total,
    //     SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    //     COUNT(DISTINCT company_name) as companies,
    //     COUNT(DISTINCT filer_name) as filers
    //   FROM filings
    // `);
const result = await pool.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
    COUNT(DISTINCT company_name) as companies,
    COUNT(DISTINCT filer_name) as filers
  FROM filings
  WHERE status IN ('pending', 'approved', 'rejected')
`);
    return json(result.rows[0]);

  } catch (err) {
    console.log('STATS ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};