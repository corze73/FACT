/* eslint-env node */
import { neon } from '@neondatabase/serverless';

// Server-side database connection - credentials never sent to client
const getDatabaseConnection = () => {
  // eslint-disable-next-line no-undef
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Return the query function with fullResults enabled
  return neon(databaseUrl, { fullResults: true });
};

/**
 * Execute a SQL query against the Neon database
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export async function executeQuery(query, params = []) {
  try {
    const sql = getDatabaseConnection();
    // Neon returns { rows, fields, rowCount, ... }
    const result = await sql(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Execute a single-row query
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} Single row result or null
 */
export async function executeQueryOne(query, params = []) {
  const result = await executeQuery(query, params);
  return result.length > 0 ? result[0] : null;
}

export default {
  executeQuery,
  executeQueryOne
};
