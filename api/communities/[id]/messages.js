const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // Permisos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);
        const communityId = req.query.id;

        // Migración perezosa: asegurar que existe la columna image_url
        await sql`ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS image_url TEXT`;

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

        // ESCRIBIR MENSAJE (Soportando imágenes)
        if (req.method === 'POST') {
            const { userId, content, image_url } = req.body;

            if (!userId || (!content && !image_url)) {
                return res.status(400).json({ message: 'Faltan datos.' });
            }

            const newMessage = await sql`
                INSERT INTO community_messages (community_id, user_id, content, image_url) 
                VALUES (${communityId}, ${userId}, ${content || ''}, ${image_url || null})
                RETURNING id, content, image_url, created_at
            `;
            await sql`UPDATE communities SET total_messages = total_messages + 1 WHERE id = ${communityId}`;

            return res.status(201).json({ message: 'Mensaje enviado', data: newMessage[0] });
        }

        return res.status(405).json({ message: 'Método no permitido.' });

    } catch (error) {
        console.error('Error en messages:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};