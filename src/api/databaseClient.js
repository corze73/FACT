import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing database environment variable. Please set VITE_DATABASE_URL in your .env file.');
}

// Create Neon database connection
export const sql = neon(databaseUrl);

// Helper function to execute queries
export const db = {
  // Execute raw SQL query
  async query(text, params = []) {
    try {
      return await sql(text, params);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  // SELECT queries
  async select(table, options = {}) {
    let query = `SELECT * FROM ${table}`;
    const params = [];
    let paramIndex = 1;

    if (options.where) {
      const conditions = [];
      for (const [key, value] of Object.entries(options.where)) {
        if (value === null) {
          conditions.push(`${key} IS NULL`);
        } else {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    if (options.orderBy) {
      const orderParts = [];
      for (const [column, direction] of Object.entries(options.orderBy)) {
        orderParts.push(`${column} ${direction.toUpperCase()}`);
      }
      query += ` ORDER BY ${orderParts.join(', ')}`;
    }

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    return await this.query(query, params);
  },

  // INSERT query
  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result[0];
  },

  // UPDATE query
  async update(table, id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
    
    const query = `
      UPDATE ${table} 
      SET ${setClauses}, updated_at = NOW()
      WHERE id = $1 
      RETURNING *
    `;
    
    const result = await this.query(query, [id, ...values]);
    return result[0];
  },

  // DELETE query
  async delete(table, id) {
    const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
    const result = await this.query(query, [id]);
    return result[0];
  },

  // UPSERT (INSERT or UPDATE)
  async upsert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updateClauses = columns
      .filter(col => col !== 'id' && col !== 'created_at')
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders}) 
      ON CONFLICT (id) DO UPDATE SET 
      ${updateClauses}, updated_at = NOW()
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result[0];
  }
};

// Simple auth simulation (since we don't have Supabase auth)
export const auth = {
  currentUser: null,
  
  async getUser() {
    // For now, return a mock user - you'll need to implement proper auth
    return {
      data: {
        user: this.currentUser || {
          id: '77a9682b-9f8d-4d2a-b9ff-77b9a0a0042d', // Your admin ID from the data
          email: 'corze73@gmail.com'
        }
      },
      error: null
    };
  },

  async signOut() {
    this.currentUser = null;
    return { error: null };
  }
};