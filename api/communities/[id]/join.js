const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);
        const communityId = req.query.id;


        if (req.method === 'GET') {
            const userId = req.query.userId;

            // Si nadie ha iniciado sesión, obviamente no es miembro
            if (!userId) return res.status(200).json({ isMember: false });

            const rows = await sql`
                SELECT * FROM community_members 
                WHERE user_id = ${userId} AND community_id = ${communityId}
            `;
            // Devuelve true si lo encuentra, false si no, y el rol
            const isMember = rows.length > 0;
            return res.status(200).json({ 
                isMember, 
                role: isMember ? rows[0].role : null 
            });
        }


        if (req.method === 'POST') {
            const { userId } = req.body;
            if (!userId) return res.status(400).json({ message: 'Falta el ID del usuario.' });

            const rows = await sql`
                SELECT * FROM community_members 
                WHERE user_id = ${userId} AND community_id = ${communityId}
            `;

            if (rows.length > 0) {
                await sql`DELETE FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
                await sql`UPDATE communities SET member_count = member_count - 1 WHERE id = ${communityId}`;
                return res.status(200).json({ message: 'Has abandonado la comunidad', isMember: false, role: null });
            } else {
                await sql`INSERT INTO community_members (user_id, community_id, joined_at, role) VALUES (${userId}, ${communityId}, NOW(), 'member')`;
                await sql`UPDATE communities SET member_count = member_count + 1 WHERE id = ${communityId}`;
                
                // Obtener nombre de la comunidad para la actividad
                const communityRows = await sql`SELECT name FROM communities WHERE id = ${communityId}`;
                const communityName = communityRows.length > 0 ? communityRows[0].name : 'una comunidad';

                // Registrar actividad
                await sql`
                    INSERT INTO activities (user_id, type, target_id, target_name)
                    VALUES (${userId}, 'join_community', ${communityId.toString()}, ${communityName})
                `;

                // Comprobar premios
                const communityCountQuery = await sql`SELECT COUNT(*) as count FROM community_members WHERE user_id = ${userId}`;
                const communityCount = parseInt(communityCountQuery[0].count, 10);
                
                const potentialAwards = await sql`
                    SELECT id FROM awards 
                    WHERE type = 'communities' 
                    AND requirement <= ${communityCount}
                    AND id NOT IN (SELECT award_id FROM user_awards WHERE user_id = ${userId})
                `;

                for (const award of potentialAwards) {
                    await sql`
                        INSERT INTO user_awards (user_id, award_id, obtained_at)
                        VALUES (${userId}, ${award.id}, NOW())
                        ON CONFLICT DO NOTHING
                    `;
                }

                return res.status(200).json({ message: 'Te has unido a la comunidad', isMember: true, role: 'member' });
            }
        }

        return res.status(405).json({ message: 'Método no permitido.' });

    } catch (error) {
        console.error('Error en join:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};