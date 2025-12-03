// api/login.ts
import { getSql } from '../lib/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET_KEY = 'mi_secreto_temporal'; // Idealmente esto va en variables de entorno

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { username, password } = req.body;
        const sql = getSql();

        const users = await sql`SELECT * FROM users WHERE email = $1', [username]`;
        if (users.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

        const validPassword = await bcrypt.compare(password, users[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign({ id: users[0].id, email: users[0].email }, SECRET_KEY, { expiresIn: '1h' });

        return res.status(200).json({ token, message: 'Login exitoso' });
    } catch (error) {
        return res.status(500).json({ error: 'Error del servidor' });
    }
}