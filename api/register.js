const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs'); // <-- ¡IMPORTANTE! Usamos bcryptjs para evitar errores en Vercel

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
        // 1. Ahora también sacamos el 'name' (Nombre real) del frontend
        // Nota: tu frontend usa 'username' para enviar el correo
        const { name, username, password } = req.body;

        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('Falta la variable DATABASE_URL');

        const sql = neon(dbUrl);

        // 2. Comprobamos si el correo (username) ya existe
        const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;

        if (userCheck.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. ¡LA MAGIA! Guardamos el 'name' en su columna, y el 'username' en el 'email'
        await sql`
            INSERT INTO users (name, email, password) 
            VALUES (${name}, ${username}, ${hashedPassword})
        `;

        return res.status(201).json({ message: 'Usuario registrado correctamente' });

    } catch (error) {
        console.error('Error completo:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            details: error.message
        });
    }
};