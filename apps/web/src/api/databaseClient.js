import { neon } from '@neondatabase/serverless';

// In production builds, direct client-side DB access is disabled.
// Always use Netlify Functions via apiClient instead. This module remains for
// limited local/dev tooling where RLS is acceptable in browser.
const isDev = import.meta.env.DEV === true;
const databaseUrl = isDev ? import.meta.env.VITE_DATABASE_URL : undefined;

// Create Neon database connection only in dev to avoid leaking envs/secrets.
export const sql = databaseUrl
  ? neon(databaseUrl, { disableWarningInBrowsers: true })
  : null;

// Helper function to execute queries
export const db = {
  // Set current user context for RLS
  async setUserContext(userId) {
    if (userId) {
      await sql.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    } else {
      await sql.query(`SELECT set_config('app.current_user_id', '', true)`);
    }
  },

  // Execute raw SQL query
  async query(text, params = []) {
    if (!sql) {
      throw new Error('Direct DB access is disabled. Use API endpoints instead.');
    }
    try {
      return await sql.query(text, params);
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

const decodeStoredAuthToken = () => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;

    const normalizedPayload = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalizedPayload)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const payload = JSON.parse(json);

    if (!payload?.sub) return null;

    return {
      id: payload.sub,
      email: payload.email || null,
      user_type: payload.user_type || 'client',
      role: payload.user_type === 'admin' ? 'admin' : 'user'
    };
  } catch (error) {
    console.error('Error decoding stored auth token:', error);
    return null;
  }
};

// Simple auth simulation (custom authentication for Neon)
export const auth = {
  currentUser: null,
  
  // Initialize auth from localStorage on app start
  async init() {
    const storedUser = localStorage.getItem('currentUser');
    const fallbackUser = storedUser ? null : decodeStoredAuthToken();
    if (storedUser || fallbackUser) {
      try {
        this.currentUser = storedUser ? JSON.parse(storedUser) : fallbackUser;
        if (!storedUser && fallbackUser) {
          localStorage.setItem('currentUser', JSON.stringify(fallbackUser));
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
        localStorage.removeItem('currentUser');
        return;
      }

      // Set user context for RLS in dev only. Do not clear the cached session on
      // transient context/network failures; the API layer remains the source of truth.
      if (sql) {
        try {
          await db.setUserContext(this.currentUser.id);
        } catch (error) {
          console.error('Error setting stored user context:', error);
        }
      }
    }
  },
  
  async setCurrentUser(user) {
    this.currentUser = user;
    // Persist to localStorage
    if (user) {
      const token = user?.token || localStorage.getItem('authToken');
      const { token: _token, ...safeUser } = user;
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      if (token) {
        localStorage.setItem('authToken', token);
      }
      if (sql) {
        await db.setUserContext(user.id);
      }
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      if (sql) {
        await db.setUserContext(null);
      }
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