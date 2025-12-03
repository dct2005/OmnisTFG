// api/register.js
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');

module.exports = async function handler(req, res) {
    // Configuración CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        // Conexión a DB
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('Falta la variable DATABASE_URL');
        }

        const sql = neon(dbUrl);

        // Verificar si existe
        const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;

        if (userCheck.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar
        await sql`INSERT INTO users (email, password) VALUES (${username}, ${hashedPassword})`;

        return res.status(201).json({ message: 'Usuario registrado correctamente' });

    } catch (error) {
        console.error('Error completo:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            details: error.message
        });
    }
};