const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'mi_secreto_temporal';

module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb' // Must be under 4.5MB for Vercel edge limits
        }
    }
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        console.log(`[API User] ${req.method} request received. Action: ${req.body?.action || req.query?.action}`);
        const sql = neon(process.env.DATABASE_URL);

        // Update last activity ONLY for actions performed by the current user
        // Actions that identify the requester: log in, register, or any POST update
        // We avoid updating last_activity on generic GET lookups for other users (like profile view)
        const possibleEmail = req.body?.email || req.body?.username || (req.method === 'GET' && req.query?.action === 'get' ? req.query?.email : null);
        const isAction = req.method === 'POST';
        
        if (possibleEmail && isAction || (req.method === 'GET' && req.query?.action === 'get' && req.query?.email)) {
             const emailForUpdate = possibleEmail;
             await sql`UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE email = ${emailForUpdate}`;
        }

        async function verifyToken(req) {
            const authHeader = req.headers.authorization;
            if (!authHeader) return null;
            const token = authHeader.split(' ')[1];
            try {
                return jwt.verify(token, SECRET_KEY);
            } catch (e) {
                return null;
            }
        }

        async function getUserWithBadges(user) {
            const gamesCountQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${user.id}`;
            const gamesCount = parseInt(gamesCountQuery[0].count, 10);

            // 1.2 Loyalty Badges (Time based)
            const accountAgeInDays = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24));
            const loyaltyBadges = [];
            if (accountAgeInDays >= 7) loyaltyBadges.push({ id: 'loyalty_7d', name: 'Omnis: Iniciación al Tiempo', icon: '/images/badges/loyalty_7d.png', description: 'conseguida al entrar 7 días a la página' });
            if (accountAgeInDays >= 30) loyaltyBadges.push({ id: 'loyalty_30d', name: 'Omnis: Custodia Mensual', icon: '/images/badges/loyalty_30d.png', description: 'conseguida al entrar 30 días a la página' });
            if (accountAgeInDays >= 365) loyaltyBadges.push({ id: 'loyalty_1y', name: 'Omnis: Forja Anual', icon: '/images/badges/loyalty_1y.png', description: 'conseguida al entrar 365 días a la página' });
            if (accountAgeInDays >= 1095) loyaltyBadges.push({ id: 'loyalty_3y', name: 'Omnis: Maestría Cósmica', icon: '/images/badges/loyalty_3y.png', description: 'conseguida al entrar 1000+ días a la página' });

            const hardcodedBadges = [...loyaltyBadges];
            if (gamesCount >= 1) hardcodedBadges.push({ id: 101, name: 'Novato de Élite', icon: '/images/ins_nonecesito.png', description: 'Compraste 1 juego.' });
            if (gamesCount >= 3) hardcodedBadges.push({ id: 102, name: 'Borracho de Época', icon: '/images/ins_borracho.png', description: 'Compraste 3 juegos.' });
            if (gamesCount >= 5) hardcodedBadges.push({ id: 103, name: 'Cuñao Honorario', icon: '/images/ins_cunado.png', description: 'Compraste 5 juegos.' });
            if (gamesCount >= 7) hardcodedBadges.push({ id: 104, name: 'Cállese y Tome mi Dinero', icon: '/images/ins_callese.png', description: 'Compraste 7 juegos.' });
            if (gamesCount >= 10) hardcodedBadges.push({ id: 105, name: 'Frozen Mind Legend', icon: '/images/ins_frozenmind.png', description: 'Compraste 10 juegos.' });

            // 2. Premios del Perfil (3D Trophies from DB)
            const userAwards = await sql`
                SELECT a.*, a.icon_url as icon, ua.obtained_at, ua.is_pinned
                FROM awards a
                JOIN user_awards ua ON a.id = ua.award_id
                WHERE ua.user_id = ${user.id}
                ORDER BY a.requirement DESC
            `;

            // Identificar la insignia actual (lateral)
            let currentBadge = hardcodedBadges.find(b => b.id == user.selected_badge_id);
            if (!currentBadge && hardcodedBadges.length > 0) {
                currentBadge = hardcodedBadges[hardcodedBadges.length - 1];
            }
            if (!currentBadge) {
                currentBadge = { name: 'Sin Insignias', icon: 'images/ins_nonecesito.png' };
            }

            // 3. Mascota Activa
            const activePetQuery = await sql`
                SELECT p.* 
                FROM pets p
                JOIN user_pets up ON p.id = up.pet_id
                WHERE up.user_id = ${user.id} AND up.is_active = TRUE
                LIMIT 1
            `;
            const activePet = activePetQuery[0] || null;

            const { password: _, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                badges: hardcodedBadges, // Se mantienen como insignias secundarias
                current_badge: currentBadge,
                all_awards: userAwards, // Todos los premios obtenidos
                pinned_awards: userAwards.filter(a => a.is_pinned), // Premios para la Vitrina
                active_pet: activePet
            };
        }

        async function checkAndGrantAwards(userId, type) {
            if (type === 'genre') {
                const userGamesMetadata = await sql`
                    SELECT g.genres, g.themes 
                    FROM user_games ug
                    JOIN games g ON ug.game_api_id = CAST(g.id AS TEXT)
                    WHERE ug.user_id = ${userId}
                `;
                
                const allPlayerGenres = new Set();
                userGamesMetadata.forEach(g => {
                    if (g.genres) g.genres.forEach(gen => allPlayerGenres.add(gen));
                    if (g.themes) g.themes.forEach(t => allPlayerGenres.add(t));
                });

                const potentialAwards = await sql`
                    SELECT * FROM awards 
                    WHERE type = 'genre' 
                    AND id NOT IN (SELECT award_id FROM user_awards WHERE user_id = ${userId})
                `;

                for (const award of potentialAwards) {
                    const requiredGenres = award.requirement.split(',');
                    const hasAchievement = requiredGenres.some(req => allPlayerGenres.has(req));
                    
                    if (hasAchievement) {
                        await sql`
                            INSERT INTO user_awards (user_id, award_id, obtained_at)
                            VALUES (${userId}, ${award.id}, NOW())
                            ON CONFLICT DO NOTHING
                        `;
                        // Auto-desbloquear mascota asociada
                        const linkedPet = await sql`SELECT id FROM pets WHERE award_id = ${award.id} LIMIT 1`;
                        if (linkedPet.length > 0) {
                            await sql`
                                INSERT INTO user_pets (user_id, pet_id, unlocked_at)
                                VALUES (${userId}, ${linkedPet[0].id}, NOW())
                                ON CONFLICT DO NOTHING
                            `;
                        }
                    }
                }
                return;
            }

            let currentValue = 0;
            if (type === 'games') {
                const countQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${userId}`;
                currentValue = parseInt(countQuery[0].count, 10);
            } else if (type === 'communities') {
                const countQuery = await sql`SELECT COUNT(*) as count FROM community_members WHERE user_id = ${userId}`;
                currentValue = parseInt(countQuery[0].count, 10);
            }

            const potentialAwards = await sql`
                SELECT id FROM awards 
                WHERE type = ${type} 
                AND CAST(requirement AS INTEGER) <= ${currentValue}
                AND id NOT IN (SELECT award_id FROM user_awards WHERE user_id = ${userId})
            `;

            for (const award of potentialAwards) {
                await sql`
                    INSERT INTO user_awards (user_id, award_id, obtained_at)
                    VALUES (${userId}, ${award.id}, NOW())
                    ON CONFLICT DO NOTHING
                `;
                // Auto-desbloquear mascota asociada
                const linkedPet = await sql`SELECT id FROM pets WHERE award_id = ${award.id} LIMIT 1`;
                if (linkedPet.length > 0) {
                    await sql`
                        INSERT INTO user_pets (user_id, pet_id, unlocked_at)
                        VALUES (${userId}, ${linkedPet[0].id}, NOW())
                        ON CONFLICT DO NOTHING
                    `;
                }
            }
        }

        // OBTENER RECURSO DEL USUARIO
        if (req.method === 'GET') {
            const { email, username, action } = req.query;

            if (action === 'get-by-id') {
                const { id } = req.query;
                if (!id) return res.status(400).json({ error: 'Falta id' });
                const users = await sql`SELECT * FROM users WHERE id = ${id}`;
                if (users.length === 0) return res.status(404).json({ error: 'No encontrado' });
                const richUser = await getUserWithBadges(users[0]);
                return res.status(200).json(richUser);
            }

            if (action === 'get-status') {
                const { username } = req.query;
                if (!username) return res.status(400).json({ error: 'Falta username' });
                const users = await sql`SELECT id, username, estado, current_activity, last_activity FROM users WHERE username = ${username}`;
                if (users.length === 0) return res.status(404).json({ error: 'No encontrado' });
                return res.status(200).json(users[0]);
            }

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
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_activity TEXT DEFAULT 'Explorando Omnis'`;
                return res.status(200).json({ message: 'Migración completada' });
            }

            if (action === 'migrate-gamification') {
                // 1. Tablas de Misiones
                await sql`
                    CREATE TABLE IF NOT EXISTS daily_quests (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        type TEXT NOT NULL, -- 'join_community', 'send_message', 'add_friend'
                        requirement_value INTEGER DEFAULT 1,
                        xp_reward INTEGER DEFAULT 100,
                        points_reward INTEGER DEFAULT 50
                    )
                `;
                await sql`
                    CREATE TABLE IF NOT EXISTS user_quests (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        quest_id INTEGER REFERENCES daily_quests(id),
                        current_value INTEGER DEFAULT 0,
                        is_completed BOOLEAN DEFAULT FALSE,
                        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, quest_id)
                    )
                `;

                // 2. XP y Nivel en Comunidades
                await sql`ALTER TABLE communities ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0`;
                await sql`ALTER TABLE communities ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1`;

                // 3. Música en el Perfil
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_music_url TEXT DEFAULT NULL`;

                // 4. Insertar Misiones Iniciales si no existen
                await sql`ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS description TEXT`;
                await sql`ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS icon VARCHAR(50)`;

                await sql`
                    INSERT INTO daily_quests (title, type, requirement_value, xp_reward, points_reward, description, icon)
                    VALUES 
                        ('Explorador Social', 'join_community', 1, 150, 50, 'Interactúa con otros usuarios uniéndote a un nuevo grupo de la comunidad.', 'groups'),
                        ('Mensajero Veloz', 'send_message', 1, 100, 30, 'Comparte tus pensamientos y mantén viva la conversación en cualquier comunidad.', 'chat')
                    ON CONFLICT DO NOTHING
                `;

                // Actualizar las existentes por si acaso
                await sql`UPDATE daily_quests SET description = 'Interactúa con otros usuarios uniéndote a un nuevo grupo de la comunidad.', icon = 'groups' WHERE type = 'join_community'`;
                await sql`UPDATE daily_quests SET description = 'Comparte tus pensamientos y mantén viva la conversación en cualquier comunidad.', icon = 'chat' WHERE type = 'send_message'`;

                return res.status(200).json({ message: 'Migración de gamificación completada' });
            }

            if (action === 'get-daily-quests') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                // Asegurar schema por si no se corrió la migración manual
                await sql`ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS description TEXT`;
                await sql`ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS icon VARCHAR(50)`;

                // Actualizar misiones base si no tienen descripción (solo una vez)
                await sql`UPDATE daily_quests SET description = 'Interactúa con otros usuarios uniéndote a un nuevo grupo de la comunidad.', icon = 'groups' WHERE type = 'join_community' AND description IS NULL`;
                await sql`UPDATE daily_quests SET description = 'Comparte tus pensamientos y mantén viva la conversación en cualquier comunidad.', icon = 'chat' WHERE type = 'send_message' AND description IS NULL`;

                // Sincronizar misiones (asegurar que el usuario tenga registros en user_quests para hoy)
                await sql`
                    INSERT INTO user_quests (user_id, quest_id)
                    SELECT ${userId}, id FROM daily_quests
                    ON CONFLICT (user_id, quest_id) DO NOTHING
                `;

                const quests = await sql`
                    SELECT 
                        dq.id, dq.title, dq.type, dq.requirement_value, dq.xp_reward, dq.points_reward,
                        dq.description, dq.icon,
                        uq.current_value, uq.is_completed
                    FROM daily_quests dq
                    JOIN user_quests uq ON dq.id = uq.quest_id
                    WHERE uq.user_id = ${userId}
                `;

                return res.status(200).json(quests);
            }

            if (action === 'migrate-support') {
                await sql`
                    CREATE TABLE IF NOT EXISTS support_tickets (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        category TEXT NOT NULL,
                        product_name TEXT,
                        subject TEXT,
                        details TEXT NOT NULL,
                        status TEXT DEFAULT 'open',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                await sql`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS subject TEXT`;
                return res.status(200).json({ message: 'Soporte migrado correctamente' });
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

            if (action === 'get-game-sales-history') {
                const { requesterEmail, gameId } = req.query;
                if (!requesterEmail || !gameId) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const history = await sql`
                    SELECT DATE(purchase_date) as date, COUNT(*) as sales 
                    FROM user_games 
                    WHERE game_api_id = ${gameId.toString()} 
                    GROUP BY DATE(purchase_date) 
                    ORDER BY date ASC
                `;
                return res.status(200).json(history);
            }

            if (action === 'get-community-growth-history') {
                const { requesterEmail, communityId } = req.query;
                if (!requesterEmail || !communityId) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                // Obtener el conteo acumulativo de miembros por día
                const history = await sql`
                    SELECT DATE(joined_at) as date, COUNT(*) as daily_joins
                    FROM community_members
                    WHERE community_id = ${parseInt(communityId, 10)}
                    GROUP BY DATE(joined_at)
                    ORDER BY date ASC
                `;
                return res.status(200).json(history);
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
            if (action === 'get-user-transactions-admin') {
                const { requesterEmail, userId } = req.query;
                if (!requesterEmail || !userId) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const transactions = await sql`
                    SELECT id, peppix_amount, real_money_euro, payment_method, created_at 
                    FROM transactions 
                    WHERE user_id = ${userId} 
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(transactions);
            }

            if (action === 'search-users') {
                const { query } = req.query;
                if (!query) return res.status(200).json([]);

                const users = await sql`
                    SELECT id, username, profile_image, xp, estado, current_activity 
                    FROM users 
                    WHERE username ILIKE ${'%' + query + '%'}
                    ORDER BY username ASC
                    LIMIT 15
                `;
                
                return res.status(200).json(users);
            }

            if (action === 'get-friends') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const friends = await sql`
                    SELECT 
                        u.id, u.username, u.profile_image, u.estado, u.current_activity,
                        f.status, f.sender_id, f.id as friendship_id
                    FROM friendships f
                    JOIN users u ON (u.id = f.sender_id OR u.id = f.receiver_id)
                    WHERE (f.sender_id = ${userId} OR f.receiver_id = ${userId})
                    AND u.id != ${userId}
                `;
                return res.status(200).json(friends);
            }

            if (action === 'get-notifications') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const notifications = await sql`
                    SELECT * FROM notifications 
                    WHERE user_id = ${userId} 
                    ORDER BY created_at DESC 
                    LIMIT 20
                `;
                return res.status(200).json(notifications);
            }

            if (action === 'get-tickets') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });
                const tickets = await sql`
                    SELECT * FROM support_tickets 
                    WHERE user_id = ${userId} 
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(tickets);
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

            if (action === 'get-all-users') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const allUsers = await sql`SELECT id, username, email, role, created_at, last_activity, peppix, estado, profile_image FROM users ORDER BY id ASC`;
                return res.status(200).json(allUsers);
            }

            if (action === 'get-all-reports') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const allReports = await sql`
                    SELECT st.*, u.username as user_name, u.email as user_email 
                    FROM support_tickets st
                    JOIN users u ON st.user_id = u.id
                    ORDER BY st.created_at DESC
                `;
                return res.status(200).json(allReports);
            }

            if (action === 'get-all-communities') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const communities = await sql`
                    SELECT c.*, COUNT(cm.user_id) as num_members
                    FROM communities c
                    LEFT JOIN community_members cm ON c.id = cm.community_id
                    GROUP BY c.id
                    ORDER BY COUNT(cm.user_id) DESC
                `;
                return res.status(200).json(communities);
            }

            if (action === 'get-all-transactions-admin') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const transactions = await sql`
                    SELECT t.*, u.username, u.email
                    FROM transactions t
                    JOIN users u ON t.user_id = u.id
                    ORDER BY t.created_at DESC
                    LIMIT 200
                `;
                return res.status(200).json(transactions);
            }

            if (action === 'get-all-games-admin') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const games = await sql`
                    SELECT game_api_id, COUNT(*) as sales_count
                    FROM user_games
                    GROUP BY game_api_id
                    ORDER BY sales_count DESC
                `;
                return res.status(200).json(games);
            }
            if (action === 'bootstrap-admin') {
                const { email: emailToBootstrap } = req.query;
                if (!emailToBootstrap) return res.status(400).json({ error: 'Falta email' });
                
                const updated = await sql`UPDATE users SET role = 'administrador' WHERE email = ${emailToBootstrap} RETURNING id, email, role`;
                if (updated.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
                
                return res.status(200).json({ message: '¡Ahora eres administrador!', user: updated[0] });
            }

            if (action === 'get-admin-stats') {
                const { requesterEmail } = req.query;
                if (!requesterEmail) return res.status(400).json({ error: 'Falta email del solicitante' });
                
                const requester = await sql`SELECT role FROM users WHERE email = ${requesterEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                const stats = {};
                
                const userCounts = await sql`SELECT COUNT(*) as total, SUM(peppix) as total_peppix FROM users`;
                stats.totalUsers = parseInt(userCounts[0].total, 10);
                stats.totalPeppix = parseInt(userCounts[0].total_peppix || 0, 10);

                const roleCounts = await sql`SELECT role, COUNT(*) as count FROM users GROUP BY role`;
                stats.adminCount = parseInt(roleCounts.find(r => r.role === 'administrador')?.count || 0, 10);
                stats.userCount = parseInt(roleCounts.find(r => r.role === 'cliente')?.count || 0, 10);

                const activeToday = await sql`SELECT COUNT(*) as active FROM users WHERE last_activity >= CURRENT_DATE`;
                stats.activeToday = parseInt(activeToday[0].active, 10);

                const revenue = await sql`SELECT SUM(real_money_euro) as total_revenue FROM transactions`;
                stats.totalRevenue = parseFloat(revenue[0].total_revenue || 0);

                const gamesSold = await sql`SELECT COUNT(*) as sold FROM user_games`;
                stats.totalGamesSold = parseInt(gamesSold[0].sold, 10);

                const tickets = await sql`SELECT status, COUNT(*) as count FROM support_tickets GROUP BY status`;
                stats.openTickets = parseInt(tickets.find(t => t.status === 'open')?.count || 0, 10);
                stats.closedTickets = parseInt(tickets.find(t => t.status === 'closed')?.count || 0, 10);

                const communities = await sql`SELECT COUNT(*) as count FROM communities`;
                stats.totalCommunities = parseInt(communities[0].count, 10);

                // --- HIGHLIGHTS / HALL OF FAME ---
                
                // 1. Juego más vendido (Histórico)
                const topGame = await sql`
                    SELECT game_api_id, COUNT(*) as count 
                    FROM user_games 
                    GROUP BY game_api_id 
                    ORDER BY count DESC 
                    LIMIT 1
                `;
                stats.topGame = topGame.length > 0 ? topGame[0] : null;

                // 2. Comunidad más popular
                const topCommunity = await sql`
                    SELECT c.id, c.name, c.description, c.image_url, c.categoria, COUNT(cm.user_id) as total_members
                    FROM communities c
                    JOIN community_members cm ON c.id = cm.community_id
                    GROUP BY c.id, c.name, c.description, c.image_url, c.categoria
                    ORDER BY total_members DESC
                    LIMIT 1
                `;
                stats.topCommunity = topCommunity.length > 0 ? { 
                    ...topCommunity[0], 
                    total_members: parseInt(topCommunity[0].total_members, 10) 
                } : null;

                // 3. Mayor Comprador (Histórico)
                const topBuyer = await sql`
                    SELECT u.username, u.profile_image, SUM(t.real_money_euro) as total_spent, MAX(t.created_at) as last_purchase
                    FROM transactions t
                    JOIN users u ON t.user_id = u.id
                    GROUP BY u.id, u.username, u.profile_image
                    ORDER BY total_spent DESC
                    LIMIT 1
                `;
                stats.topBuyer = topBuyer.length > 0 ? { 
                    username: topBuyer[0].username, 
                    profile_image: topBuyer[0].profile_image,
                    total_spent: parseFloat(topBuyer[0].total_spent || 0),
                    last_purchase: topBuyer[0].last_purchase
                } : null;

                // 4. Coleccionista de Élite (Más juegos)
                const topCollector = await sql`
                    SELECT u.username, u.profile_image, COUNT(ug.game_api_id) as total_games
                    FROM user_games ug
                    JOIN users u ON ug.user_id = u.id
                    GROUP BY u.id, u.username, u.profile_image
                    ORDER BY total_games DESC
                    LIMIT 1
                `;
                stats.topCollector = topCollector.length > 0 ? { 
                    username: topCollector[0].username, 
                    profile_image: topCollector[0].profile_image,
                    total_games: parseInt(topCollector[0].total_games, 10) 
                } : null;

                console.log('[Admin Stats] Detailed highlights calculated');
                return res.status(200).json(stats);
            }

            if (!email && !username && !['get-any-game', 'get-profile-comments', 'get-pets', 'get-tickets', 'check-daily-reward', 'get-transactions', 'get-friends', 'get-user-comments', 'get-all-reports', 'get-admin-stats'].includes(action)) {
                return res.status(400).json({ error: 'Falta email o username' });
            }

            let user;
            if (email) {
                const users = await sql`SELECT * FROM users WHERE email = ${email}`;
                if (users.length === 0 && !['get-any-game', 'get-profile-comments', 'get-pets', 'get-tickets', 'check-daily-reward', 'get-transactions', 'get-friends', 'get-user-comments'].includes(action)) {
                    return res.status(404).json({ error: 'User no encontrado' });
                }
                user = users[0];
            } else if (username) {
                const users = await sql`SELECT * FROM users WHERE username = ${username}`;
                if (users.length === 0) return res.status(404).json({ error: 'User no encontrado' });
                user = users[0];
            }

            if (action === 'get-pets') {
                const { userId } = req.query;
                const petUserId = userId || user?.id;
                if (!petUserId) return res.status(400).json({ error: 'Falta userId' });

                const allPets = await sql`
                    SELECT p.*, (up.id IS NOT NULL) as unlocked, COALESCE(up.is_active, FALSE) as is_active
                    FROM pets p
                    LEFT JOIN user_pets up ON p.id = up.pet_id AND up.user_id = ${petUserId}
                    ORDER BY p.id ASC
                `;
                return res.status(200).json(allPets);
            }

            if (action === 'get-user-games') {
                const games = await sql`SELECT game_api_id, purchase_date, price_paid FROM user_games WHERE user_id = ${user.id} ORDER BY purchase_date DESC`;
                const totalValue = await sql`SELECT SUM(price_paid) as total FROM user_games WHERE user_id = ${user.id}`;
                return res.status(200).json({ 
                    games, 
                    totalLibraryValue: parseInt(totalValue[0].total || 0, 10) 
                });
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

            // Fetch unread notifications for logged in user (if applicable)
            let unreadNotifications = [];
            const decoded = await verifyToken(req);
            if (decoded && decoded.email === user.email) {
                unreadNotifications = await sql`
                    SELECT * FROM notifications 
                    WHERE user_id = ${user.id} AND is_read = FALSE 
                    ORDER BY created_at DESC
                `;
            }

            return res.status(200).json({
                user: fullUser,
                initialComments,
                unreadNotifications
            });
        }

        if (req.method === 'POST') {
            const action = req.body?.action || req.query?.action;
            const { email, password, name, username, estado } = req.body;

            if (action === 'claim-quest-reward') {
                const { userId, questId } = req.body;
                if (!userId || !questId) return res.status(400).json({ error: 'Faltan datos' });

                const questStatus = await sql`
                    SELECT uq.*, dq.xp_reward, dq.points_reward, dq.requirement_value
                    FROM user_quests uq
                    JOIN daily_quests dq ON uq.quest_id = dq.id
                    WHERE uq.user_id = ${userId} AND uq.quest_id = ${questId}
                `;

                if (questStatus.length === 0) return res.status(404).json({ error: 'Misión no encontrada' });
                const quest = questStatus[0];

                if (quest.is_completed) return res.status(400).json({ error: 'Misión ya reclamada' });
                if (quest.current_value < quest.requirement_value) return res.status(400).json({ error: 'Misión no completada' });

                // Marcar como completada y dar recompensas
                await sql`UPDATE user_quests SET is_completed = TRUE WHERE id = ${quest.id}`;
                await sql`UPDATE users SET xp = xp + ${quest.xp_reward} WHERE id = ${userId}`;
                
                return res.status(200).json({ 
                    message: 'Recompensa reclamada con éxito',
                    xp_reward: quest.xp_reward,
                    points_reward: quest.points_reward
                });
            }

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
                
                // Add notification for the profile owner
                if (profile_user_id !== author_user_id) {
                    const profileOwner = await sql`SELECT username FROM users WHERE id = ${profile_user_id}`;
                    const profileOwnerName = profileOwner[0]?.username || '';
                    
                    await sql`
                        INSERT INTO notifications (user_id, type, title, message, link)
                        VALUES (${profile_user_id}, 'profile_comment', 'Nuevo comentario', 'Tienes un nuevo comentario de ' || ${commenter[0].author_name}, '/perfil/' || ${profileOwnerName})
                    `;
                }

                return res.status(201).json({
                    ...inserted[0],
                    author_name: commenter[0].author_name,
                    author_image: commenter[0].author_image
                });
            }

            if (action === 'create-ticket') {
                const { userId, category, productName, gameId, subject, details } = req.body;
                if (!userId || !category || !details) return res.status(400).json({ error: 'Faltan datos' });
                const inserted = await sql`
                    INSERT INTO support_tickets (user_id, category, product_name, game_api_id, subject, details)
                    VALUES (${userId}, ${category}, ${productName}, ${gameId}, ${subject}, ${details})
                    RETURNING *
                `;
                return res.status(201).json(inserted[0]);
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

            if (action === 'delete-user') {
                const { adminEmail, userIdToDelete } = req.body;
                if (!adminEmail || !userIdToDelete) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${adminEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                // Borrar datos relacionados antes de borrar al usuario
                await sql`DELETE FROM profile_comments WHERE profile_user_id = ${userIdToDelete} OR author_user_id = ${userIdToDelete}`;
                await sql`DELETE FROM community_messages WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM community_members WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM user_games WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM user_wishlist WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM support_tickets WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM transactions WHERE user_id = ${userIdToDelete}`;
                await sql`DELETE FROM friendships WHERE sender_id = ${userIdToDelete} OR receiver_id = ${userIdToDelete}`;
                
                const deleted = await sql`DELETE FROM users WHERE id = ${userIdToDelete} RETURNING id`;
                if (deleted.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

                return res.status(200).json({ message: 'Usuario y todos sus datos asociados han sido eliminados' });
            }

            if (action === 'delete-community') {
                const { adminEmail, communityId } = req.body;
                if (!adminEmail || !communityId) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${adminEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                await sql`DELETE FROM community_messages WHERE community_id = ${communityId}`;
                await sql`DELETE FROM community_members WHERE community_id = ${communityId}`;
                const deleted = await sql`DELETE FROM communities WHERE id = ${communityId} RETURNING id`;
                
                if (deleted.length === 0) return res.status(404).json({ error: 'Comunidad no encontrada' });

                return res.status(200).json({ message: 'Comunidad eliminada correctamente' });
            }

            if (action === 'update-report-status') {
                const { adminEmail, reportId, newStatus, adminResponse } = req.body;
                if (!adminEmail || !reportId || !newStatus) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${adminEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                let updated;
                if (adminResponse !== undefined) {
                    updated = await sql`UPDATE support_tickets SET status = ${newStatus}, admin_response = ${adminResponse} WHERE id = ${reportId} RETURNING *`;
                } else {
                    updated = await sql`UPDATE support_tickets SET status = ${newStatus} WHERE id = ${reportId} RETURNING *`;
                }

                if (updated.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });

                return res.status(200).json({ message: 'Estado del reporte actualizado', report: updated[0] });
            }

            if (action === 'update-activity') {
                const { email, activity } = req.body;
                if (!email) return res.status(400).json({ error: 'Falta email' });

                await sql`
                    UPDATE users 
                    SET current_activity = ${activity}, 
                        last_activity = CURRENT_TIMESTAMP 
                    WHERE email = ${email}
                `;
                return res.status(200).json({ success: true });
            }

            if (action === 'refund-game') {
                const { adminEmail, reportId, userId, gameId, amount } = req.body;
                if (!adminEmail || !reportId || !userId || !gameId || amount === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${adminEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                // 1. Eliminar juego de la biblioteca
                await sql`DELETE FROM user_games WHERE user_id = ${userId} AND game_api_id = ${gameId.toString()}`;

                // 2. Devolver Peppix al usuario
                await sql`UPDATE users SET peppix = peppix + ${amount} WHERE id = ${userId}`;

                // 3. Registrar transacción
                await sql`
                    INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method, created_at)
                    VALUES (${userId}, ${amount}, 0, 'Reembolso Soporte', NOW())
                `;

                // 4. Cerrar el reporte con mensaje automático
                const adminResponse = `REEMBOLSO PROCESADO: Se han devuelto ${amount} Peppix a tu cuenta y el juego ha sido retirado de tu biblioteca.`;
                const updated = await sql`UPDATE support_tickets SET status = 'closed', admin_response = ${adminResponse} WHERE id = ${reportId} RETURNING *`;

                return res.status(200).json({ message: 'Reembolso procesado correctamente', report: updated[0] });
            }

            if (action === 'resolve-purchase-report') {
                const { adminEmail, reportId, userId, amount } = req.body;
                if (!adminEmail || !reportId || !userId || amount === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const requester = await sql`SELECT role FROM users WHERE email = ${adminEmail}`;
                if (requester.length === 0 || requester[0].role !== 'administrador') {
                    return res.status(403).json({ error: 'No tienes permisos de administrador' });
                }

                // 1. Sumar Peppix al saldo del usuario
                await sql`UPDATE users SET peppix = peppix + ${amount} WHERE id = ${userId}`;

                // 2. Registrar transacción de ingreso manual
                await sql`
                    INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method, created_at)
                    VALUES (${userId}, ${amount}, 0, 'Compra Manual (Soporte)', NOW())
                `;

                // 3. Cerrar el reporte con respuesta técnica
                const resolutionMsg = `Soporte ha ingresado manualmente ${amount} Peppix tras verificar la reclamación.`;
                await sql`UPDATE support_tickets SET status = 'closed', admin_response = ${resolutionMsg} WHERE id = ${reportId}`;

                return res.status(200).json({ message: 'Peppix ingresados y reporte cerrado' });
            }

            if (action === 'register') {
                if (!name || !username || !password) return res.status(400).json({ error: 'Faltan datos' });

                const userCheck = await sql`SELECT * FROM users WHERE email = ${username}`;
                if (userCheck.length > 0) return res.status(409).json({ error: 'El usuario ya existe' });

                const hashedPassword = await bcrypt.hash(password, 10);
                const inserted = await sql`
                    INSERT INTO users (username, email, password, peppix, estado, role) 
                    VALUES (${name}, ${username}, ${hashedPassword}, 0, 'desconectado', 'cliente')
                    RETURNING id, username, email, peppix, estado, role, created_at
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

                const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
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
                        role: user.role,
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
                const { gameId, price, gameName } = req.body;
                if (!email || !gameId || price === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const userCheck = await sql`SELECT id, peppix FROM users WHERE email = ${email}`;
                if (userCheck.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                const user = userCheck[0];
                if (user.peppix < price) return res.status(400).json({ error: 'Saldo insuficiente' });

                // Fetch game metadata from IGDB to cache it locally
                try {
                    const axios = require('axios');
                    const gameInfoResponse = await axios.post(
                        "https://api.igdb.com/v4/games",
                        `fields name, genres.name, themes.name; where id = ${gameId};`,
                        {
                            headers: {
                                "Client-ID": process.env.TWITCH_CLIENT_ID,
                                "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                            }
                        }
                    );

                    if (gameInfoResponse.data && gameInfoResponse.data.length > 0) {
                        const g = gameInfoResponse.data[0];
                        const genres = g.genres ? g.genres.map(gen => gen.name) : [];
                        const themes = g.themes ? g.themes.map(t => t.name) : [];
                        
                        await sql`
                            INSERT INTO games (id, name, genres, themes)
                            VALUES (${g.id}, ${g.name}, ${genres}, ${themes})
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                genres = EXCLUDED.genres,
                                themes = EXCLUDED.themes
                        `;
                    }
                } catch (err) {
                    console.error("[Purchase] Error caching game metadata:", err.message);
                }

                const updated = await sql`UPDATE users SET peppix = peppix - ${price}, xp = xp + ${price} WHERE email = ${email} RETURNING id, username, email, peppix, xp, estado, profile_background`;

                await sql`
                    INSERT INTO user_games (user_id, game_api_id, purchase_date, price_paid)
                    VALUES (${user.id}, ${gameId.toString()}, NOW(), ${price})
                    ON CONFLICT (user_id, game_api_id) DO UPDATE SET price_paid = ${price}
                `;

                // Registrar actividad
                await sql`
                    INSERT INTO activities (user_id, type, target_id, target_name)
                    VALUES (${user.id}, 'purchase', ${gameId.toString()}, ${gameName || 'un juego'})
                `;

                // Comprobar premios
                await checkAndGrantAwards(user.id, 'games');
                await checkAndGrantAwards(user.id, 'genre');

                await sql`DELETE FROM user_wishlist WHERE user_id = ${user.id} AND game_api_id = ${gameId.toString()}`;

                return res.status(200).json({ message: 'Compra realizada', user: updated[0] });
            }

            if (action === 'update-profile-image') {
                const { profileImage } = req.body;
                if (!email || !profileImage) return res.status(400).json({ error: 'Faltan datos' });

                const decoded = await verifyToken(req);
                if (!decoded || decoded.email !== email) {
                    return res.status(403).json({ error: 'No autorizado para cambiar esta foto' });
                }

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

            if (action === 'update-profile-music') {
                const { profileMusic } = req.body;
                if (!email || profileMusic === undefined) return res.status(400).json({ error: 'Faltan datos' });

                const decoded = await verifyToken(req);
                if (!decoded || decoded.email !== email) {
                    return res.status(403).json({ error: 'No autorizado para cambiar el audio' });
                }

                const updated = await sql`
                    UPDATE users 
                    SET profile_music_url = ${profileMusic} 
                    WHERE email = ${email} 
                    RETURNING id, username, email, peppix, xp, estado, profile_music_url
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'User no encontrado' });

                return res.status(200).json({
                    message: 'Música actualizada con éxito',
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
                    username,
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
                    profile_name_color,
                    profile_music_url
                } = req.body;

                if (!email) return res.status(400).json({ error: 'Falta email' });

                const updated = await sql`
                    UPDATE users 
                    SET 
                        username = ${username},
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
                        profile_name_color = ${profile_name_color || '#ffffff'},
                        profile_music_url = ${profile_music_url}
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

            if (action === 'update-active-pet') {
                const { userId, petId, active } = req.body;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                await sql`UPDATE user_pets SET is_active = FALSE WHERE user_id = ${userId}`;
                
                if (active && petId) {
                    await sql`
                        UPDATE user_pets 
                        SET is_active = TRUE 
                        WHERE user_id = ${userId} AND pet_id = ${petId}
                    `;
                }
                
                const userQuery = await sql`SELECT * FROM users WHERE id = ${userId}`;
                const userData = await getUserWithBadges(userQuery[0]);
                return res.status(200).json(userData);
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

            if (action === 'mark-notifications-read') {
                const { userId } = req.body;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });
                await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${userId}`;
                return res.status(200).json({ success: true });
            }

            return res.status(400).json({ error: 'Acción inválida' });
        }
    } catch (error) {
        console.error('[API User Error]', error);
        return res.status(500).json({ error: 'Error del servidor', details: error.message });
    }
};
