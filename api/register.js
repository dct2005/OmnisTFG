const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { name, username, password } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const sql = neon(process.env.DATABASE_URL);

        // Comprobamos si el email ya existe (username en el body es el email)
        const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;
        if (userCheck.length > 0) return res.status(409).json({ error: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // MAPEO CORRECTO SEGÚN TU TABLA:
        // name (Nombre completo) -> va a la columna 'username'
        // username (Email) -> va a la columna 'email'
        await sql`
            INSERT INTO users (username, email, password) 
            VALUES (${name}, ${username}, ${hashedPassword})
        `;

        return res.status(201).json({ message: 'Usuario registrado correctamente' });

    } catch (error) {
        return res.status(500).json({ error: 'Error del servidor', details: error.message });
    }
};