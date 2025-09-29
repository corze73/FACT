import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.VITE_DATABASE_URL);

export { sql };
export const db = sql;  // For compatibility with existing imports
export default sql;