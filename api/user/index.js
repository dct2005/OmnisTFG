const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'mi_secreto_temporal'; // Usar process.env.JWT_SECRET idealmente en produccion

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);

        // OBTENER RECURSO DEL USUARIO
        if (req.method === 'GET') {
            const email = req.query.email;
            if (!email) return res.status(400).json({ error: 'Falta email' });

            const users = await sql`SELECT id, email, username, estado, peppix, created_at FROM users WHERE email = ${email}`;
            if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });

            return res.status(200).json({ user: users[0] });
        }

        // ACCIONES DE USUARIO E IDENTIDAD
        if (req.method === 'POST') {
            const { action, email, password, name, username, estado, amount } = req.body;

            // 1. Registro
            if (action === 'register') {
                if (!name || !username || !password) return res.status(400).json({ error: 'Faltan datos' });
                
                const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;
                if (userCheck.length > 0) return res.status(409).json({ error: 'El usuario ya existe' });

                const hashedPassword = await bcrypt.hash(password, 10);
                const inserted = await sql`
                    INSERT INTO users (username, email, password, peppix, estado) 
                    VALUES (${name}, ${username}, ${hashedPassword}, 0, 'desconectado')
                    RETURNING id, username, email, peppix, estado, created_at
                `;
                return res.status(201).json({ message: 'Registrado correctamente', user: inserted[0] });
            }

            // 2. Login
            if (action === 'login') {
                if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
                const users = await sql`SELECT * FROM users WHERE email = ${username}`;
                if (users.length === 0) return res.status(401).json({ error: 'No encontrado' });

                const user = users[0];
                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

                const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
                // Devolvemos el usuario directamente sin cambiarle el estado
                return res.status(200).json({ token, message: 'Login exitoso', user: {
                    id: user.id, 
                    username: user.username, 
                    email: user.email, 
                    peppix: user.peppix, 
                    estado: user.estado, 
                    created_at: user.created_at
                }});
            }

            // 3. Actualizar estado
            if (action === 'update-estado') {
                if (!email || !estado) return res.status(400).json({ error: 'Faltan datos' });
                const updated = await sql`UPDATE users SET estado = ${estado} WHERE email = ${email} RETURNING id, username, email, peppix, estado`;
                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                return res.status(200).json({ message: 'Estado actualizado', user: updated[0] });
            }

            // 4. Actualizar Peppix
            if (action === 'update-peppix') {
                if (!email || amount === undefined) return res.status(400).json({ error: 'Faltan datos' });
                const updated = await sql`UPDATE users SET peppix = peppix + ${amount} WHERE email = ${email} RETURNING id, username, email, peppix, estado`;
                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                return res.status(200).json({ message: 'Peppix actualizados', user: updated[0] });
            }

            return res.status(400).json({ error: 'Acción no válida' });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (err) {
        console.error('Error in user API:', err);
        return res.status(500).json({ error: 'Error del servidor', details: err.message });
    }
};
