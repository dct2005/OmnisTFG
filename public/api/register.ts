// api/register.ts
import { getSql } from '../lib/db';
import bcrypt from 'bcrypt';

export default async function handler(req: any, res: any) {
    // Configuración de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Validación de método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const sql = getSql();

        // --- CORRECCIÓN LÍNEA 37 ---
        // Usamos comillas invertidas (backticks) y ponemos la variable directamente
        const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;

        if (userCheck.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // --- CORRECCIÓN LÍNEA 47 ---
        // Usamos comillas invertidas y variables directas. ¡Adiós a los $1, $2!
        await sql`INSERT INTO users (email, password) VALUES (${username}, ${hashedPassword})`;

        return res.status(201).json({ message: 'Usuario registrado correctamente' });

    } catch (error) {
        console.error('Error en register:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}