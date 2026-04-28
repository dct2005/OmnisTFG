const { getSql } = require('../../lib/db');

module.exports = async function handler(req, res) {
    let sql;
    try {
        sql = getSql();
    } catch (err) {
        return res.status(500).json({ error: 'Configuración de base de datos incorrecta' });
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { gameId, userId } = req.query;

            if (gameId) {
                // Fetch reviews for a specific game
                const reviews = await sql`
                    SELECT gr.id, gr.user_id, gr.game_api_id, gr.game_name, gr.content, gr.created_at, u.username, u.profile_image 
                    FROM game_reviews gr
                    JOIN users u ON gr.user_id = u.id
                    WHERE gr.game_api_id = ${gameId}
                    ORDER BY gr.created_at DESC
                `;
                return res.status(200).json(reviews);
            }

            if (userId) {
                // Fetch reviews for a specific user
                const reviews = await sql`
                    SELECT id, user_id, game_api_id, game_name, content, created_at 
                    FROM game_reviews 
                    WHERE user_id = ${userId}
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(reviews);
            }

            return res.status(400).json({ error: 'Falta gameId o userId' });
        }

        if (req.method === 'POST') {
            const { userId, gameId, gameName, content } = req.body;

            if (!userId || !gameId || !content) {
                return res.status(400).json({ error: 'Faltan datos obligatorios' });
            }

            const newReview = await sql`
                INSERT INTO game_reviews (user_id, game_api_id, game_name, content)
                VALUES (${userId}, ${gameId}, ${gameName}, ${content})
                RETURNING *
            `;

            return res.status(201).json(newReview[0]);
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error en game-reviews API:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};
