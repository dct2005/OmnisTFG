const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const sql = neon(process.env.DATABASE_URL);
    const { action } = req.query;

    try {
        // --- RANKINGS ---
        if (action === 'rankings') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
            
            const topBuyers = await sql`
                SELECT u.id, u.username, u.profile_image, u.estado, COUNT(ug.game_api_id) as count
                FROM users u
                JOIN user_games ug ON u.id = ug.user_id
                GROUP BY u.id, u.username, u.profile_image, u.estado
                ORDER BY count DESC
                LIMIT 50
            `;

            const topCommunities = await sql`
                SELECT u.id, u.username, u.profile_image, u.estado, COUNT(cm.community_id) as count
                FROM users u
                JOIN community_members cm ON u.id = cm.user_id
                GROUP BY u.id, u.username, u.profile_image, u.estado
                ORDER BY count DESC
                LIMIT 50
            `;

            const topFriends = await sql`
                SELECT u.id, u.username, u.profile_image, u.estado, COUNT(f.id) as count
                FROM users u
                JOIN friendships f ON (u.id = f.sender_id OR u.id = f.receiver_id)
                WHERE f.status = 'accepted'
                GROUP BY u.id, u.username, u.profile_image, u.estado
                ORDER BY count DESC
                LIMIT 50
            `;

            const topValue = await sql`
                SELECT u.id, u.username, u.profile_image, u.estado, SUM(ug.price_paid) as count
                FROM users u
                JOIN user_games ug ON u.id = ug.user_id
                GROUP BY u.id, u.username, u.profile_image, u.estado
                ORDER BY count DESC
                LIMIT 50
            `;

            return res.status(200).json({
                top_buyers: topBuyers.map(u => ({ ...u, count: parseInt(u.count, 10) })),
                top_communities: topCommunities.map(u => ({ ...u, count: parseInt(u.count, 10) })),
                top_friends: topFriends.map(u => ({ ...u, count: parseInt(u.count, 10) })),
                top_value: topValue.map(u => ({ ...u, count: parseInt(u.count, 10) }))
            });
        }

        // --- ACTIVITIES ---
        if (action === 'activities') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: 'Falta ID de usuario' });

            const activities = await sql`
                SELECT a.id, a.user_id, a.type, a.target_id, a.target_name, a.created_at, u.username, u.profile_image
                FROM activities a
                JOIN users u ON a.user_id = u.id
                WHERE a.user_id IN (
                    SELECT receiver_id FROM friendships WHERE sender_id = ${userId} AND status = 'accepted'
                    UNION
                    SELECT sender_id FROM friendships WHERE receiver_id = ${userId} AND status = 'accepted'
                )
                ORDER BY a.created_at DESC
                LIMIT 20
            `;
            return res.status(200).json(activities);
        }

        // --- AWARDS ---
        if (action === 'awards' || (!action && (req.method === 'GET' || req.method === 'POST'))) {
            if (req.method === 'GET') {
                const { userId } = req.query;
                const allAwards = await sql`SELECT * FROM awards ORDER BY type, requirement`;
                let userAwards = [];
                if (userId) {
                    userAwards = await sql`SELECT award_id, is_pinned FROM user_awards WHERE user_id = ${userId}`;
                }
                const awardsWithStatus = allAwards.map(award => {
                    const owned = userAwards.find(ua => ua.award_id === award.id);
                    return { ...award, owned: !!owned, is_pinned: owned ? owned.is_pinned : false };
                });
                return res.status(200).json(awardsWithStatus);
            }

            if (req.method === 'POST') {
                const { userId, awardId, action: awardAction } = req.body;
                if (!userId || !awardId) return res.status(400).json({ error: 'Faltan datos' });

                if (awardAction === 'toggle-pin') {
                    const check = await sql`SELECT id, is_pinned FROM user_awards WHERE user_id = ${userId} AND award_id = ${awardId}`;
                    if (check.length === 0) return res.status(403).json({ error: 'No posees este premio' });

                    const newPinStatus = !check[0].is_pinned;
                    if (newPinStatus) {
                        const pinnedCount = await sql`SELECT COUNT(*) as count FROM user_awards WHERE user_id = ${userId} AND is_pinned = true`;
                        if (parseInt(pinnedCount[0].count, 10) >= 5) {
                            return res.status(400).json({ error: 'Ya tienes 5 premios anclados (límite máximo)' });
                        }
                    }
                    await sql`UPDATE user_awards SET is_pinned = ${newPinStatus} WHERE user_id = ${userId} AND award_id = ${awardId}`;
                    return res.status(200).json({ message: 'Pin toggled', is_pinned: newPinStatus });
                }
                return res.status(400).json({ error: 'Acción no válida' });
            }
        }

        return res.status(404).json({ error: 'Acción no encontrada' });

    } catch (error) {
        console.error('Social API Error:', error);
        return res.status(500).json({ error: 'Error del servidor', details: error.message });
    }
};
