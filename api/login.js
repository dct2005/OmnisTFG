// api/login.js
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'mi_secreto_temporal'; // En el futuro, usa process.env.JWT_SECRET

module.exports = async function handler(req, res) {
    // 1. Configuración CORS
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
            return res.status(400).json({ error: 'Faltan email o contraseña' });
        }

        // 2. Conexión directa a DB (para evitar ciclos)
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('Falta la variable DATABASE_URL');
        }
        const sql = neon(dbUrl);

        // 3. Buscar usuario
        const users = await sql`SELECT * FROM users WHERE email = ${username}`;

        if (users.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const user = users[0];

        // 4. Comparar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // 5. Generar Token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        return res.status(200).json({ token, message: 'Login exitoso' });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            details: error.message
        });
    }
};