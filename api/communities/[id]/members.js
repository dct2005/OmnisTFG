const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);
        const communityId = req.query.id;

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
            // Expulsar miembro (Acción: kick)
            const { userId, adminId } = req.body;
            if (!userId || !adminId) return res.status(400).json({ error: 'Faltan IDs' });

            // Verificar si el ejecutor es admin
            const adminCheck = await sql`
                SELECT role FROM community_members 
                WHERE user_id = ${adminId} AND community_id = ${communityId}
            `;

            if (adminCheck.length === 0 || adminCheck[0].role !== 'administrador') {
                return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
            }

            // Eliminar miembro
            await sql`DELETE FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
            await sql`UPDATE communities SET member_count = member_count - 1 WHERE id = ${communityId}`;

            return res.status(200).json({ message: 'Miembro expulsado con éxito' });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error en api/communities/members:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};
