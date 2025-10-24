import { neon } from '@neondatabase/serverless';

// Get database URL from environment variables
// Server (Node/Netlify Functions): prefer DATABASE_URL; fallback to VITE_DATABASE_URL for local scripts
// Browser (Vite client): uses VITE_DATABASE_URL at build/runtime, but we avoid exposing DB URL in production
const databaseUrl = (typeof window === 'undefined')
  ? (process.env.DATABASE_URL || process.env.VITE_DATABASE_URL)
  : import.meta.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL (server) or VITE_DATABASE_URL (client/local) is not set');
}

const sql = neon(databaseUrl);

// Simple auth state management for client-side
const auth = {
  currentUser: null,
  
  async getUser() {
    // Get user from localStorage
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      this.currentUser = JSON.parse(userData);
      return { data: { user: this.currentUser }, error: null };
    }
    return { data: { user: null }, error: null };
  },
  
  async setCurrentUser(user) {
    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  },
  
  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    return { error: null };
  }
};

// Database wrapper with better error handling
const db = {
  async select(table, options = {}) {
    try {
      let query = `SELECT * FROM ${table}`;
      const params = [];
      
      if (options.where) {
        const conditions = [];
        let paramIndex = 1;
        
        for (const [key, value] of Object.entries(options.where)) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
      }
      
      if (options.orderBy) {
        const orderClauses = [];
        for (const [column, direction] of Object.entries(options.orderBy)) {
          orderClauses.push(`${column} ${direction.toUpperCase()}`);
        }
        query += ` ORDER BY ${orderClauses.join(', ')}`;
      }
      
      if (options.limit) {
        query += ` LIMIT ${options.limit}`;
      }
      
      return await sql(query, params);
    } catch (error) {
      console.error(`Database select error on ${table}:`, error);
      throw error;
    }
  },
  
  async insert(table, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await sql(query, values);
      return result[0];
    } catch (error) {
      console.error(`Database insert error on ${table}:`, error);
      throw error;
    }
  },
  
  async upsert(table, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const updateClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${table} (${columns.join(', ')}) 
        VALUES (${placeholders}) 
        ON CONFLICT (id) 
        DO UPDATE SET ${updateClauses}
        RETURNING *
      `;
      const result = await sql(query, values);
      return result[0];
    } catch (error) {
      console.error(`Database upsert error on ${table}:`, error);
      throw error;
    }
  },
  
  async query(queryString, params = []) {
    try {
      return await sql(queryString, params);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

export { sql, db, auth };
export default sql;