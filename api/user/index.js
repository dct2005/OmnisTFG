const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'mi_secreto_temporal';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        console.log(`[API User] ${req.method} request received. Action: ${req.body?.action || req.query?.action}`);
        const sql = neon(process.env.DATABASE_URL);

        // OBTENER RECURSO DEL USUARIO
        if (req.method === 'GET') {
            const { email, action } = req.query;

            if (action === 'get-any-game') {
                const games = await sql`SELECT game_api_id FROM user_games ORDER BY purchase_date DESC LIMIT 1`;
                if (games.length === 0) return res.status(404).json({ error: 'No hay juegos en la BD' });
                return res.status(200).json({ games: [games[0].game_api_id] });
            }

            if (action === 'get-user-comments') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const comments = await sql`
                    SELECT m.id, m.content, m.created_at, c.name as community_name, c.id as community_id
                    FROM community_messages m
                    JOIN communities c ON m.community_id = c.id
                    WHERE m.user_id = ${userId}
                    ORDER BY m.created_at DESC
                    LIMIT 20
                `;
                return res.status(200).json(comments);
            }

            if (action === 'get-transactions') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const transactions = await sql`
                    SELECT id, peppix_amount, real_money_euro, payment_method, created_at 
                    FROM transactions 
                    WHERE user_id = ${userId} 
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(transactions);
            }

            if (!email) return res.status(400).json({ error: 'Falta email' });

            if (action === 'get-user-games') {
                const userCheck = await sql`SELECT id FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const games = await sql`SELECT game_api_id, purchase_date FROM user_games WHERE user_id = ${userCheck[0].id} ORDER BY purchase_date DESC`;
                return res.status(200).json({ games });
            }

            if (action === 'get-wishlist') {
                const userCheck = await sql`SELECT id FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const wishlist = await sql`SELECT game_api_id FROM user_wishlist WHERE user_id = ${userCheck[0].id}`;
                return res.status(200).json({ wishlist: wishlist.map(w => w.game_api_id) });
            }

            const users = await sql`
                SELECT id, email, username, first_name, last_name, address, phone, peppix, xp, estado, profile_image, profile_background, location, created_at 
                FROM users WHERE email = ${email}
            `;
            if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });

            const user = users[0];

            // Calcular insignias dinámicas
            const gamesCountQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${user.id}`;
            const gamesCount = parseInt(gamesCountQuery[0].count, 10);

            const badges = [];
            if (gamesCount >= 1) badges.push({ name: 'Novato de Élite', icon: 'images/ins_nonecesito.png', tier: 1 });
            if (gamesCount >= 3) badges.push({ name: 'Borracho de Época', icon: 'images/ins_borracho.png', tier: 2 });
            if (gamesCount >= 5) badges.push({ name: 'Cuñao Honorario', icon: 'images/ins_cunado.png', tier: 3 });
            if (gamesCount >= 7) badges.push({ name: 'Cállese y Tome mi Dinero', icon: 'images/ins_callese.png', tier: 4 });
            if (gamesCount >= 10) badges.push({ name: 'Frozen Mind Legend', icon: 'images/ins_frozenmind.png', tier: 5 });

            // Identificar la insignia principal (la de mayor tier)
            const currentBadge = badges.length > 0 ? badges[badges.length - 1] : { name: 'Sin Insignias', icon: 'images/ins_nonecesito.png', tier: 0 };

            // Remove password for security
            const { password: _, ...userWithoutPassword } = user;
            return res.status(200).json({ 
                user: { 
                    ...userWithoutPassword, 
                    badges,
                    current_badge: currentBadge
                } 
            });
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
                return res.status(200).json({
                    token, message: 'Login exitoso', user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        address: user.address,
                        phone: user.phone,
                        peppix: user.peppix,
                        estado: user.estado,
                        created_at: user.created_at
                    }
                });
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
                const { amount, price, method } = req.body;
                if (!email || amount === undefined) return res.status(400).json({ error: 'Faltan datos' });

                // Transacción: Actualizar peppix e insertar en transactions
                const userCheck = await sql`SELECT id FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                const userId = userCheck[0].id;

                await sql`UPDATE users SET peppix = peppix + ${amount} WHERE email = ${email}`;

                // Registrar en tabla transactions
                await sql`
                    INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method, created_at)
                    VALUES (${userId}, ${amount}, ${price || 0}, ${method || 'tarjeta'}, NOW())
                `;

                const updated = await sql`SELECT id, username, email, peppix, xp, estado, profile_background FROM users WHERE email = ${email}`;
                return res.status(200).json({ message: 'Peppix actualizados y transacción registrada', user: updated[0] });
            }

            // 5. Comprar Juego
            if (action === 'purchase-game') {
                const { gameId, price } = req.body;
                if (!email || !gameId || price === undefined) return res.status(400).json({ error: 'Faltan datos' });

                // Transacción manual: Restar peppix e insertar en user_games
                const userCheck = await sql`SELECT id, peppix FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const user = userCheck[0];
                if (user.peppix < price) return res.status(400).json({ error: 'Saldo insuficiente' });

                // Actualizar peppix y sumar XP
                const updated = await sql`UPDATE users SET peppix = peppix - ${price}, xp = xp + ${price} WHERE email = ${email} RETURNING id, username, email, peppix, xp, estado, profile_background`;

                // Registrar compra
                await sql`
                    INSERT INTO user_games (user_id, game_api_id, purchase_date)
                    VALUES (${user.id}, ${gameId.toString()}, NOW())
                    ON CONFLICT (user_id, game_api_id) DO NOTHING
                `;

                // Eliminar de la lista de deseos si existe
                await sql`DELETE FROM user_wishlist WHERE user_id = ${user.id} AND game_api_id = ${gameId.toString()}`;

                return res.status(200).json({ message: 'Compra realizada', user: updated[0] });
            }

            // 6. Actualizar Imagen de Perfil
            if (action === 'update-profile-image') {
                const { profileImage } = req.body;
                if (!email || !profileImage) return res.status(400).json({ error: 'Faltan datos' });

                const updated = await sql`
                    UPDATE users 
                    SET profile_image = ${profileImage} 
                    WHERE email = ${email} 
                    RETURNING id, username, email, peppix, xp, estado, profile_image, profile_background
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                return res.status(200).json({ 
                    message: 'Imagen actualizada con éxito', 
                    user: updated[0] 
                });
            }

            if (action === 'update-location') {
                const { location } = req.body;
                if (!email || !location) return res.status(400).json({ error: 'Faltan datos' });

                const updated = await sql`
                    UPDATE users 
                    SET location = ${location} 
                    WHERE email = ${email} 
                    RETURNING id, username, email, peppix, xp, estado, profile_image, profile_background, location
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                return res.status(200).json({ 
                    message: 'Localización actualizada con éxito', 
                    user: updated[0] 
                });
            }

            if (action === 'update-profile-background') {
                const { background } = req.body;
                if (!email || !background) return res.status(400).json({ error: 'Faltan datos' });

                const updated = await sql`
                    UPDATE users 
                    SET profile_background = ${background} 
                    WHERE email = ${email} 
                    RETURNING id, username, email, peppix, xp, estado, profile_image, profile_background, location
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                return res.status(200).json({ 
                    message: 'Fondo de perfil actualizado', 
                    user: updated[0] 
                });
            }

            if (action === 'toggle-wishlist') {
                const { gameId } = req.body;
                if (!email || !gameId) return res.status(400).json({ error: 'Faltan datos' });

                const userCheck = await sql`SELECT id FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                const userId = userCheck[0].id;

                const existing = await sql`SELECT * FROM user_wishlist WHERE user_id = ${userId} AND game_api_id = ${gameId.toString()}`;

                if (existing.length > 0) {
                    await sql`DELETE FROM user_wishlist WHERE user_id = ${userId} AND game_api_id = ${gameId.toString()}`;
                    return res.status(200).json({ message: 'Eliminado de la lista de deseos', inWishlist: false });
                } else {
                    await sql`INSERT INTO user_wishlist (user_id, game_api_id) VALUES (${userId}, ${gameId.toString()})`;
                    return res.status(200).json({ message: 'Añadido a la lista de deseos', inWishlist: true });
                }
            }

            if (action === 'update-billing-info') {
                const { firstName, lastName, address, phone } = req.body;
                if (!email) return res.status(400).json({ error: 'Falta email' });

                const updated = await sql`
                    UPDATE users 
                    SET first_name = ${firstName}, last_name = ${lastName}, address = ${address}, phone = ${phone}
                    WHERE email = ${email}
                    RETURNING id, username, email, first_name, last_name, address, phone, peppix, xp, estado
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                return res.status(200).json({ 
                    message: 'Información de facturación actualizada', 
                    user: updated[0] 
                });
            }

            return res.status(400).json({ error: 'Acción no válida' });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (err) {
        console.error('Error in user API:', err);
        return res.status(500).json({ error: 'Error del servidor', details: err.message });
    }
};
