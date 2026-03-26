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

        // Update last activity for the current user (the requester)
        const requesterEmail = req.query?.email || req.body?.email;
        const requesterUsername = req.query?.username || req.body?.username;
        if (requesterEmail) {
            await sql`UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE email = ${requesterEmail}`;
        } else if (requesterUsername) {
            await sql`UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE username = ${requesterUsername}`;
        }

        async function getUserWithBadges(user) {
            const gamesCountQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${user.id}`;
            const gamesCount = parseInt(gamesCountQuery[0].count, 10);

            const badges = [];
            if (gamesCount >= 1) badges.push({ id: 1, name: 'Novato de Élite', icon: 'images/ins_nonecesito.png', tier: 1, description: 'Conseguida tras comprar 1 juego.' });
            if (gamesCount >= 3) badges.push({ id: 2, name: 'Borracho de Época', icon: 'images/ins_borracho.png', tier: 2, description: 'Conseguida tras comprar 3 juegos.' });
            if (gamesCount >= 5) badges.push({ id: 3, name: 'Cuñao Honorario', icon: 'images/ins_cunado.png', tier: 3, description: 'Conseguida tras comprar 5 juegos.' });
            if (gamesCount >= 7) badges.push({ id: 4, name: 'Cállese y Tome mi Dinero', icon: 'images/ins_callese.png', tier: 4, description: 'Conseguida tras comprar 7 juegos.' });
            if (gamesCount >= 10) badges.push({ id: 5, name: 'Frozen Mind Legend', icon: 'images/ins_frozenmind.png', tier: 5, description: 'Conseguida tras comprar 10 juegos.' });

            let currentBadge = badges.find(b => b.id == user.selected_badge_id);
            if (!currentBadge) {
                currentBadge = badges.length > 0 ? badges[badges.length - 1] : { name: 'Sin Insignias', icon: 'images/ins_nonecesito.png', tier: 0 };
            }

            const { password: _, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                badges,
                current_badge: currentBadge
            };
        }

        // OBTENER RECURSO DEL USUARIO
        if (req.method === 'GET') {
            const { email, username, action } = req.query;

            if (action === 'migrate-comments') {
                await sql`
                    CREATE TABLE IF NOT EXISTS profile_comments (
                        id SERIAL PRIMARY KEY,
                        profile_user_id INTEGER REFERENCES users(id),
                        author_user_id INTEGER REFERENCES users(id),
                        content TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_comments_type TEXT DEFAULT 'community'`;
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme_color TEXT DEFAULT '#00f2ff'`;
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg_color TEXT DEFAULT '#00f2ff'`;
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_name_color TEXT DEFAULT '#ffffff'`;
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
                return res.status(200).json({ message: 'Migración completada' });
            }

            if (action === 'get-profile-comments') {
                const { userId, limit = 5, offset = 0 } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const comments = await sql`
                    SELECT pc.id, pc.content, pc.created_at, u.username as author_name, u.profile_image as author_image, u.id as author_id
                    FROM profile_comments pc
                    JOIN users u ON pc.author_user_id = u.id
                    WHERE pc.profile_user_id = ${userId}
                    ORDER BY pc.created_at DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;
                return res.status(200).json(comments);
            }

            if (action === 'get-any-game') {
                const games = await sql`SELECT game_api_id FROM user_games ORDER BY purchase_date DESC LIMIT 1`;
                if (games.length === 0) return res.status(404).json({ error: 'No hay juegos en la BD' });
                return res.status(200).json({ games: [games[0].game_api_id] });
            }

            if (action === 'get-user-comments') {
                const { userId, limit = 5, offset = 0 } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const comments = await sql`
                    SELECT m.id, m.content, m.created_at, c.name as community_name, c.id as community_id
                    FROM community_messages m
                    JOIN communities c ON m.community_id = c.id
                    WHERE m.user_id = ${userId}
                    ORDER BY m.created_at DESC
                    LIMIT ${limit} OFFSET ${offset}
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

            if (action === 'get-friends') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const friends = await sql`
                    SELECT 
                        u.id, u.username, u.profile_image, u.estado,
                        f.status, f.sender_id, f.id as friendship_id
                    FROM friendships f
                    JOIN users u ON (u.id = f.sender_id OR u.id = f.receiver_id)
                    WHERE (f.sender_id = ${userId} OR f.receiver_id = ${userId})
                    AND u.id != ${userId}
                `;
                return res.status(200).json(friends);
            }

            if (action === 'check-daily-reward') {
                const { email } = req.query;
                if (!email) return res.status(400).json({ error: 'Falta email' });

                const userQuery = await sql`SELECT last_daily_reward FROM users WHERE email = ${email}`;
                if (userQuery.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const lastReward = userQuery[0].last_daily_reward;
                if (!lastReward) return res.status(200).json({ canClaim: true });

                const lastDate = new Date(lastReward).toDateString();
                const today = new Date().toDateString();

                return res.status(200).json({ canClaim: lastDate !== today });
            }

            if (!email && !username) return res.status(400).json({ error: 'Falta email o username' });

            let user;
            if (email) {
                const users = await sql`SELECT * FROM users WHERE email = ${email}`;
                if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                user = users[0];
            } else {
                const users = await sql`SELECT * FROM users WHERE username = ${username}`;
                if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                user = users[0];
            }

            if (action === 'get-user-games') {
                const games = await sql`SELECT game_api_id, purchase_date FROM user_games WHERE user_id = ${user.id} ORDER BY purchase_date DESC`;
                return res.status(200).json({ games });
            }

            if (action === 'get-wishlist') {
                const wishlist = await sql`SELECT game_api_id FROM user_wishlist WHERE user_id = ${user.id}`;
                return res.status(200).json({ wishlist: wishlist.map(w => w.game_api_id) });
            }

            const fullUser = await getUserWithBadges(user);

            // Fetch initial 5 comments based on preference
            let initialComments = [];
            if (fullUser.display_comments_type === 'profile') {
                initialComments = await sql`
                    SELECT pc.id, pc.content, pc.created_at, u.username as author_name, u.profile_image as author_image, u.id as author_id
                    FROM profile_comments pc
                    JOIN users u ON pc.author_user_id = u.id
                    WHERE pc.profile_user_id = ${user.id}
                    ORDER BY pc.created_at DESC
                    LIMIT 5
                `;
            } else {
                initialComments = await sql`
                    SELECT m.id, m.content, m.created_at, c.name as community_name, c.id as community_id
                    FROM community_messages m
                    JOIN communities c ON m.community_id = c.id
                    WHERE m.user_id = ${user.id}
                    ORDER BY m.created_at DESC
                    LIMIT 5
                `;
            }

            return res.status(200).json({
                user: fullUser,
                initialComments
            });
        }

        if (req.method === 'POST') {
            const { action, email, password, name, username, estado } = req.body;

            if (action === 'add-profile-comment') {
                const { profile_user_id, author_user_id, content } = req.body;
                if (!profile_user_id || !author_user_id || !content) return res.status(400).json({ error: 'Faltan datos' });

                const inserted = await sql`
                    INSERT INTO profile_comments (profile_user_id, author_user_id, content)
                    VALUES (${profile_user_id}, ${author_user_id}, ${content})
                    RETURNING *
                `;

                // Return with author info
                const commenter = await sql`SELECT username as author_name, profile_image as author_image FROM users WHERE id = ${author_user_id}`;
                return res.status(201).json({
                    ...inserted[0],
                    author_name: commenter[0].author_name,
                    author_image: commenter[0].author_image
                });
            }

            if (action === 'delete-profile-comment') {
                const { commentId, userId } = req.body;
                if (!commentId || !userId) return res.status(400).json({ error: 'Faltan datos' });

                // Only the author or the profile owner can delete
                const comment = await sql`SELECT profile_user_id, author_user_id FROM profile_comments WHERE id = ${commentId}`;
                if (comment.length === 0) return res.status(404).json({ error: 'Comentario no encontrado' });

                if (comment[0].profile_user_id !== userId && comment[0].author_user_id !== userId) {
                    return res.status(403).json({ error: 'No tienes permiso para borrar este comentario' });
                }

                await sql`DELETE FROM profile_comments WHERE id = ${commentId}`;
                return res.status(200).json({ message: 'Comentario eliminado' });
            }

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

            if (action === 'login') {
                if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
                const users = await sql`SELECT * FROM users WHERE email = ${username}`;
                if (users.length === 0) return res.status(401).json({ error: 'No encontrado' });

                const user = users[0];
                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

                const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
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

            if (action === 'update-estado') {
                if (!email || !estado) return res.status(400).json({ error: 'Faltan datos' });
                const updated = await sql`UPDATE users SET estado = ${estado} WHERE email = ${email} RETURNING id, username, email, peppix, estado`;
                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                return res.status(200).json({ message: 'Estado actualizado', user: updated[0] });
            }

            if (action === 'update-peppix') {
                const { amount, price, method } = req.body;
                if (!email || amount === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const userCheck = await sql`SELECT id FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                const userId = userCheck[0].id;

                await sql`UPDATE users SET peppix = peppix + ${amount} WHERE email = ${email}`;

                await sql`
                    INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method, created_at)
                    VALUES (${userId}, ${amount}, ${price || 0}, ${method || 'tarjeta'}, NOW())
                `;

                const updated = await sql`SELECT id, username, email, peppix, xp, estado, profile_background FROM users WHERE email = ${email}`;
                return res.status(200).json({ message: 'Peppix actualizados y transacción registrada', user: updated[0] });
            }

            if (action === 'purchase-game') {
                const { gameId, price } = req.body;
                if (!email || !gameId || price === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const userCheck = await sql`SELECT id, peppix FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const user = userCheck[0];
                if (user.peppix < price) return res.status(400).json({ error: 'Saldo insuficiente' });

                const updated = await sql`UPDATE users SET peppix = peppix - ${price}, xp = xp + ${price} WHERE email = ${email} RETURNING id, username, email, peppix, xp, estado, profile_background`;

                await sql`
                    INSERT INTO user_games (user_id, game_api_id, purchase_date)
                    VALUES (${user.id}, ${gameId.toString()}, NOW())
                    ON CONFLICT (user_id, game_api_id) DO NOTHING
                `;

                await sql`DELETE FROM user_wishlist WHERE user_id = ${user.id} AND game_api_id = ${gameId.toString()}`;

                return res.status(200).json({ message: 'Compra realizada', user: updated[0] });
            }

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

            if (action === 'update-profile-settings') {
                const {
                    favorite_group_id,
                    favorite_game_id,
                    country,
                    state,
                    city,
                    privacy_profile,
                    privacy_games,
                    privacy_inventory,
                    privacy_comments,
                    status_message,
                    selected_badge_id,
                    estado,
                    display_comments_type,
                    profile_theme_color,
                    profile_bg_color,
                    profile_name_color
                } = req.body;

                if (!email) return res.status(400).json({ error: 'Falta email' });

                const updated = await sql`
                    UPDATE users 
                    SET 
                        favorite_group_id = ${favorite_group_id}, 
                        favorite_game_id = ${favorite_game_id}, 
                        country = ${country}, 
                        state = ${state}, 
                        city = ${city}, 
                        privacy_profile = ${privacy_profile || 'public'}, 
                        privacy_games = ${privacy_games || 'public'}, 
                        privacy_inventory = ${privacy_inventory || 'public'}, 
                        privacy_comments = ${privacy_comments || 'public'},
                        status_message = ${status_message},
                        selected_badge_id = ${selected_badge_id},
                        estado = ${estado || 'en-linea'},
                        display_comments_type = ${display_comments_type || 'community'},
                        profile_theme_color = ${profile_theme_color || '#00f2ff'},
                        profile_bg_color = ${profile_bg_color || '#00f2ff'},
                        profile_name_color = ${profile_name_color || '#ffffff'}
                    WHERE email = ${email}
                    RETURNING *
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const fullUser = await getUserWithBadges(updated[0]);

                // Also return initial comments based on the new preference
                let initialComments = [];
                if (fullUser.display_comments_type === 'profile') {
                    initialComments = await sql`
                        SELECT pc.id, pc.content, pc.created_at, u.username as author_name, u.profile_image as author_image, u.id as author_id
                        FROM profile_comments pc
                        JOIN users u ON pc.author_user_id = u.id
                        WHERE pc.profile_user_id = ${fullUser.id}
                        ORDER BY pc.created_at DESC
                        LIMIT 5
                    `;
                } else {
                    initialComments = await sql`
                        SELECT m.id, m.content, m.created_at, c.name as community_name, c.id as community_id
                        FROM community_messages m
                        JOIN communities c ON m.community_id = c.id
                        WHERE m.user_id = ${fullUser.id}
                        ORDER BY m.created_at DESC
                        LIMIT 5
                    `;
                }

                return res.status(200).json({
                    user: fullUser,
                    initialComments
                });
            }

            if (action === 'claim-daily-reward') {
                if (!email) return res.status(400).json({ error: 'Falta email' });

                const check = await sql`SELECT last_daily_reward, peppix FROM users WHERE email = ${email}`;
                if (check.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const lastReward = check[0].last_daily_reward;
                if (lastReward && new Date(lastReward).toDateString() === new Date().toDateString()) {
                    return res.status(400).json({ error: 'Ya has reclamado tu recompensa hoy' });
                }

                const prizes = [
                    { type: 'peppix', value: 50, label: '50 Peppix', weight: 35 },
                    { type: 'peppix', value: 100, label: '100 Peppix', weight: 25 },
                    { type: 'nada', value: 0, label: 'Nada', weight: 20 },
                    { type: 'peppix', value: 250, label: '250 Peppix', weight: 10 },
                    { type: 'peppix', value: 500, label: '500 Peppix', weight: 7 },
                    { type: 'peppix', value: 1000, label: '1000 Peppix', weight: 2 },
                    { type: 'game', value: 'random', label: 'Juego Gratis', weight: 1 }
                ];

                const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
                let random = Math.random() * totalWeight;
                let prize = prizes[0];

                for (const p of prizes) {
                    if (random < p.weight) {
                        prize = p;
                        break;
                    }
                    random -= p.weight;
                }

                await sql`UPDATE users SET last_daily_reward = NOW() WHERE email = ${email}`;

                if (prize.type === 'peppix') {
                    const currentPeppix = typeof check[0].peppix === 'string' ? parseInt(check[0].peppix.replace(/\./g, ''), 10) : (check[0].peppix || 0);
                    const newPeppix = currentPeppix + prize.value;
                    await sql`UPDATE users SET peppix = ${newPeppix} WHERE email = ${email}`;
                    await sql`
                        INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method)
                        SELECT id, ${prize.value}, 0, 'Recompensa Diaria'
                        FROM users WHERE email = ${email}
                    `;
                } else if (prize.type === 'game') {
                    const rewardVal = 1500;
                    const currentPeppix = typeof check[0].peppix === 'string' ? parseInt(check[0].peppix.replace(/\./g, ''), 10) : (check[0].peppix || 0);
                    await sql`UPDATE users SET peppix = ${currentPeppix + rewardVal} WHERE email = ${email}`;
                    prize = { type: 'peppix', value: rewardVal, label: 'Súper Premio: 1500 Peppix' };
                }

                return res.status(200).json({
                    message: '¡Felicidades!',
                    prize: prize
                });
            }

            if (action === 'update-password') {
                const { oldPassword, newPassword } = req.body;
                if (!email || !oldPassword || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

                const users = await sql`SELECT * FROM users WHERE email = ${email}`;
                if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const user = users[0];
                const valid = await bcrypt.compare(oldPassword, user.password);
                if (!valid) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

                const hashedNewPassword = await bcrypt.hash(newPassword, 10);
                await sql`UPDATE users SET password = ${hashedNewPassword} WHERE email = ${email}`;

                return res.status(200).json({ message: 'Contraseña actualizada correctamente' });
            }

            if (action === 'friend-request') {
                const { senderId, receiverId } = req.body;
                if (!senderId || !receiverId) return res.status(400).json({ error: 'Faltan IDs' });

                const existing = await sql`
                    SELECT id FROM friendships 
                    WHERE (sender_id = ${senderId} AND receiver_id = ${receiverId})
                    OR (sender_id = ${receiverId} AND receiver_id = ${senderId})
                `;
                if (existing.length > 0) return res.status(400).json({ error: 'Ya existe una relación o solicitud' });

                await sql`
                    INSERT INTO friendships (sender_id, receiver_id, status)
                    VALUES (${senderId}, ${receiverId}, 'pending')
                `;
                return res.status(201).json({ message: 'Solicitud enviada' });
            }

            if (action === 'accept-friend') {
                const { friendshipId } = req.body;
                if (!friendshipId) return res.status(400).json({ error: 'Falta ID de amistad' });

                await sql`
                    UPDATE friendships SET status = 'accepted', updated_at = NOW()
                    WHERE id = ${friendshipId}
                `;
                return res.status(200).json({ message: 'Solicitud aceptada' });
            }

            if (action === 'remove-friend') {
                const { friendshipId, senderId, receiverId } = req.body;

                if (friendshipId) {
                    await sql`DELETE FROM friendships WHERE id = ${friendshipId}`;
                } else if (senderId && receiverId) {
                    await sql`
                        DELETE FROM friendships 
                        WHERE (sender_id = ${senderId} AND receiver_id = ${receiverId})
                        OR (sender_id = ${receiverId} AND receiver_id = ${senderId})
                    `;
                } else {
                    return res.status(400).json({ error: 'Faltan datos para eliminar' });
                }

                return res.status(200).json({ message: 'Amistad/Solicitud eliminada' });
            }

            return res.status(400).json({ error: 'Acción no válida' });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (err) {
        console.error('Error in user API:', err);
        return res.status(500).json({ error: 'Error del servidor', details: err.message });
    }
};
