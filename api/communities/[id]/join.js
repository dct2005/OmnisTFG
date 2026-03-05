const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // Permisos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Usa POST.' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL);
        const communityId = req.query.id;
        const { userId } = req.body;

        if (!userId) return res.status(400).json({ message: 'Falta el ID del usuario.' });

        const rows = await sql`
            SELECT * FROM community_members 
            WHERE user_id = ${userId} AND community_id = ${communityId}
        `;

        if (rows.length > 0) {
            await sql`DELETE FROM community_members WHERE user_id = ${userId} AND community_id = ${communityId}`;
            await sql`UPDATE communities SET member_count = member_count - 1 WHERE id = ${communityId}`;
            return res.status(200).json({ message: 'Has abandonado la comunidad', isMember: false });
        } else {
            await sql`INSERT INTO community_members (user_id, community_id) VALUES (${userId}, ${communityId})`;
            await sql`UPDATE communities SET member_count = member_count + 1 WHERE id = ${communityId}`;
            return res.status(200).json({ message: 'Te has unido a la comunidad', isMember: true });
        }

    } catch (error) {
        console.error('Error en join:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};