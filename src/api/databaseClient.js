import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing database environment variable. Please set VITE_DATABASE_URL in your .env file.');
}

// Create Neon database connection
export const sql = neon(databaseUrl);

// Helper function to execute queries
export const db = {
  // Set current user context for RLS
  async setUserContext(userId) {
    if (userId) {
      await sql`SELECT set_config('app.current_user_id', ${userId}::text, true)`;
    } else {
      await sql`SELECT set_config('app.current_user_id', '', true)`;
    }
  },

  // Execute raw SQL query using template literals
  async query(text, params = []) {
    try {
      // Convert parameterized queries to template literals for Neon v1.0+
      if (params.length === 0) {
        // Simple query without parameters
        return await sql([text]);
      } else {
        // Build a proper template literal with parameters
        let query = text;
        params.forEach((param, index) => {
          query = query.replace(`$${index + 1}`, param);
        });
        return await sql([query]);
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  // SELECT queries using template literals
  async select(table, options = {}) {
    try {
      let baseQuery = `SELECT * FROM ${table}`;
      const whereConditions = [];
      const queryParts = [baseQuery];

      if (options.where) {
        for (const [key, value] of Object.entries(options.where)) {
          if (value === null) {
            whereConditions.push(`${key} IS NULL`);
          } else {
            whereConditions.push(`${key} = ${typeof value === 'string' ? `'${value}'` : value}`);
          }
        }
        if (whereConditions.length > 0) {
          queryParts.push(` WHERE ${whereConditions.join(' AND ')}`);
        }
      }

      if (options.orderBy) {
        const orderParts = [];
        for (const [column, direction] of Object.entries(options.orderBy)) {
          orderParts.push(`${column} ${direction.toUpperCase()}`);
        }
        queryParts.push(` ORDER BY ${orderParts.join(', ')}`);
      }

      if (options.limit) {
        queryParts.push(` LIMIT ${options.limit}`);
      }

      const finalQuery = queryParts.join('');
      return await sql([finalQuery]);
    } catch (error) {
      console.error('Database select error:', error);
      throw error;
    }
  },

  // INSERT query using template literals
  async insert(table, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const valueStrings = values.map(v => 
        v === null ? 'NULL' : 
        typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : 
        v
      );
      
      const query = `
        INSERT INTO ${table} (${columns.join(', ')}) 
        VALUES (${valueStrings.join(', ')}) 
        RETURNING *
      `;
      
      const result = await sql([query]);
      return result[0];
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  },

  // UPDATE query using template literals
  async update(table, id, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClauses = columns.map((col, i) => {
        const value = values[i];
        const valueStr = value === null ? 'NULL' : 
                        typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : 
                        value;
        return `${col} = ${valueStr}`;
      }).join(', ');
      
      const query = `
        UPDATE ${table} 
        SET ${setClauses}, updated_at = NOW()
        WHERE id = ${typeof id === 'string' ? `'${id}'` : id}
        RETURNING *
      `;
      
      const result = await sql([query]);
      return result[0];
    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    }
  },

  // DELETE query using template literals
  async delete(table, id) {
    try {
      const query = `DELETE FROM ${table} WHERE id = ${typeof id === 'string' ? `'${id}'` : id} RETURNING *`;
      const result = await sql([query]);
      return result[0];
    } catch (error) {
      console.error('Database delete error:', error);
      throw error;
    }
  },

  // UPSERT (INSERT or UPDATE) using template literals
  async upsert(table, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const valueStrings = values.map(v => 
        v === null ? 'NULL' : 
        typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : 
        v
      );
      const updateClauses = columns
        .filter(col => col !== 'id' && col !== 'created_at')
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');
      
      const query = `
        INSERT INTO ${table} (${columns.join(', ')}) 
        VALUES (${valueStrings.join(', ')}) 
        ON CONFLICT (id) DO UPDATE SET 
        ${updateClauses}, updated_at = NOW()
        RETURNING *
      `;
      
      const result = await sql([query]);
      return result[0];
    } catch (error) {
      console.error('Database upsert error:', error);
      throw error;
    }
  }
};

// Simple auth simulation (custom authentication for Neon)
export const auth = {
  currentUser: null,
  
  // Initialize auth from localStorage on app start
  async init() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
        // Set user context for RLS
        await db.setUserContext(this.currentUser.id);
      } catch (error) {
        console.error('Error loading stored user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  },
  
  async setCurrentUser(user) {
    this.currentUser = user;
    // Persist to localStorage
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      await db.setUserContext(user.id);
    } else {
      localStorage.removeItem('currentUser');
      await db.setUserContext(null);
    }
  },
  
  async getUser() {
    // Initialize if not already done
    if (!this.currentUser) {
      await this.init();
    }
    
    // Return current user only if actually logged in
    if (this.currentUser) {
      return {
        data: { user: this.currentUser },
        error: null
      };
    }
    return {
      data: { user: null },
      error: { message: 'Not authenticated' }
    };
  },

  async signOut() {
    await this.setCurrentUser(null);
    return { error: null };
  }
};