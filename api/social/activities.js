const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'Falta ID de usuario' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL);

        // Obtener actividades de amigos
        const activities = await sql`
            SELECT 
                a.id, 
                a.user_id, 
                a.type, 
                a.target_id, 
                a.target_name, 
                a.created_at,
                u.username,
                u.profile_image
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
    } catch (error) {
        console.error('Error fetching friend activities:', error);
        return res.status(500).json({ error: 'Error del servidor', details: error.message });
    }
};
