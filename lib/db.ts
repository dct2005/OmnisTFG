// lib/db.ts
import { neon } from '@neondatabase/serverless';

export function getSql() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Error: Falta la variable DATABASE_URL');
    }
    return neon(process.env.DATABASE_URL);
}