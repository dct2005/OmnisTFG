const postgres = require('postgres');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    const communityId = req.query.id;
    const { action } = req.query;

    if (!communityId) return res.status(400).json({ error: 'Falta ID de comunidad' });

    try {
        // --- JOIN / LEAVE ---
        if (action === 'join') {
            if (req.method === 'GET') {
                const { userId } = req.query;
                if (!userId) return res.status(200).json({ isMember: false });
                const rows = await sql`SELECT * FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
                const isMember = rows.length > 0;
                return res.status(200).json({ isMember, role: isMember ? rows[0].role : null });
            }
            if (req.method === 'POST') {
                const { userId } = req.body;
                if (!userId) return res.status(400).json({ message: 'Falta el ID del usuario.' });
                const rows = await sql`SELECT * FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
                if (rows.length > 0) {
                    await sql`DELETE FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
                    await sql`UPDATE communities SET member_count = member_count - 1 WHERE id = ${communityId}`;
                    return res.status(200).json({ message: 'Has abandonado la comunidad', isMember: false, role: null });
                } else {
                    await sql`INSERT INTO community_members (user_id, community_id, joined_at, role) VALUES (${userId}, ${communityId}, NOW(), 'member')`;
                    
                    // LEVELING: +50 XP on Join
                    await sql`UPDATE communities SET member_count = member_count + 1, xp = xp + 50 WHERE id = ${communityId}`;
                    
                    // QUESTS: Check 'join_community'
                    await sql`
                        INSERT INTO user_quests (user_id, quest_id, current_value)
                        SELECT ${userId}, id, 1 FROM daily_quests WHERE type = 'join_community'
                        ON CONFLICT (user_id, quest_id) DO UPDATE 
                        SET current_value = user_quests.current_value + 1, last_updated = NOW()
                        WHERE user_quests.is_completed = FALSE
                    `;

                    const comm = await sql`SELECT name FROM communities WHERE id = ${communityId}`;
                    await sql`INSERT INTO activities (user_id, type, target_id, target_name) VALUES (${userId}, 'join_community', ${communityId}, ${comm[0]?.name || 'una comunidad'})`;
                    const countRes = await sql`SELECT COUNT(*) as count FROM community_members WHERE user_id = ${userId}`;
                    const count = parseInt(countRes[0].count, 10);
                    const potentialAwards = await sql`SELECT id FROM awards WHERE type = 'communities' AND requirement <= ${count} AND id NOT IN (SELECT award_id FROM user_awards WHERE user_id = ${userId})`;
                    for (const award of potentialAwards) {
                        await sql`INSERT INTO user_awards (user_id, award_id, obtained_at) VALUES (${userId}, ${award.id}, NOW()) ON CONFLICT DO NOTHING`;
                    }
                    return res.status(200).json({ message: 'Te has unido a la comunidad', isMember: true, role: 'member' });
                }
            }
        }

        // --- MEMBERS ---
        if (action === 'members') {
            if (req.method === 'GET') {
                const members = await sql`
                    SELECT u.id, u.username, u.profile_image, cm.role, cm.joined_at
                    FROM users u
                    JOIN community_members cm ON u.id = cm.user_id
                    WHERE cm.community_id = ${communityId}
                    ORDER BY cm.joined_at ASC
                `;
                return res.status(200).json(members);
            }
            if (req.method === 'DELETE') {
                const { userId, adminId } = req.body;
                if (!userId || !adminId) return res.status(400).json({ error: 'Faltan IDs' });
                const adminCheck = await sql`SELECT role FROM community_members WHERE user_id = ${adminId} AND community_id = ${communityId}`;
                if (adminCheck.length === 0 || adminCheck[0].role !== 'administrador') return res.status(403).json({ error: 'No tienes permisos' });
                await sql`DELETE FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
                await sql`UPDATE communities SET member_count = member_count - 1 WHERE id = ${communityId}`;
                return res.status(200).json({ message: 'Miembro expulsado' });
            }
        }

        // --- MESSAGES ---
        if (action === 'messages') {
            if (req.method === 'GET') {
                const messages = await sql`
                    SELECT m.id, m.content, m.image_url, m.created_at as time, u.username as author, u.profile_image
                    FROM community_messages m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.community_id = ${communityId}
                    ORDER BY m.created_at DESC
                `;
                return res.status(200).json(messages);
            }
            if (req.method === 'POST') {
                const { userId, content, image_url } = req.body;
                if (!userId || (!content && !image_url)) return res.status(400).json({ message: 'Faltan datos.' });
                
                const newMessage = await sql`INSERT INTO community_messages (community_id, user_id, content, image_url) VALUES (${communityId}, ${userId}, ${content || ''}, ${image_url || null}) RETURNING id, content, image_url, created_at`;
                
                // LEVELING: +10 XP on Message
                await sql`UPDATE communities SET total_messages = total_messages + 1, xp = xp + 10 WHERE id = ${communityId}`;

                // QUESTS: Check 'send_message'
                await sql`
                    INSERT INTO user_quests (user_id, quest_id, current_value)
                    SELECT ${userId}, id, 1 FROM daily_quests WHERE type = 'send_message'
                    ON CONFLICT (user_id, quest_id) DO UPDATE 
                    SET current_value = user_quests.current_value + 1, last_updated = NOW()
                    WHERE user_quests.is_completed = FALSE
                `;

                return res.status(201).json({ message: 'Mensaje enviado', data: newMessage[0] });
            }
        }

        return res.status(404).json({ error: 'Acción no encontrada' });

    } catch (error) {
        console.error('Community Action Error:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};
