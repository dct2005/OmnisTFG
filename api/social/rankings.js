const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL);

        // 1. Top Buyers (Users with most games)
        const topBuyers = await sql`
            SELECT u.id, u.username, u.profile_image, u.estado, COUNT(ug.game_api_id) as count
            FROM users u
            JOIN user_games ug ON u.id = ug.user_id
            GROUP BY u.id, u.username, u.profile_image, u.estado
            ORDER BY count DESC
            LIMIT 50
        `;

        // 2. Top Community Members (Users in most communities)
        const topCommunities = await sql`
            SELECT u.id, u.username, u.profile_image, u.estado, COUNT(cm.community_id) as count
            FROM users u
            JOIN community_members cm ON u.id = cm.user_id
            GROUP BY u.id, u.username, u.profile_image, u.estado
            ORDER BY count DESC
            LIMIT 50
        `;

        // 3. Top Socialites (Users with most friends)
        // Friendship counts both where user is sender and receiver
        const topFriends = await sql`
            SELECT u.id, u.username, u.profile_image, u.estado, COUNT(f.id) as count
            FROM users u
            JOIN friendships f ON (u.id = f.sender_id OR u.id = f.receiver_id)
            WHERE f.status = 'accepted'
            GROUP BY u.id, u.username, u.profile_image, u.estado
            ORDER BY count DESC
            LIMIT 50
        `;

        return res.status(200).json({
            top_buyers: topBuyers.map(u => ({ ...u, count: parseInt(u.count, 10) })),
            top_communities: topCommunities.map(u => ({ ...u, count: parseInt(u.count, 10) })),
            top_friends: topFriends.map(u => ({ ...u, count: parseInt(u.count, 10) }))
        });

    } catch (error) {
        console.error('Error fetching rankings:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
