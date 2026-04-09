const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
        const { userId } = req.query;
        try {
            // Obtener todos los premios disponibles
            const allAwards = await sql`SELECT * FROM awards ORDER BY type, requirement`;
            
            // Si hay userId, marcar cuáles tiene el usuario
            let userAwards = [];
            if (userId) {
                userAwards = await sql`SELECT award_id, is_pinned FROM user_awards WHERE user_id = ${userId}`;
            }

            const awardsWithStatus = allAwards.map(award => {
                const owned = userAwards.find(ua => ua.award_id === award.id);
                return {
                    ...award,
                    owned: !!owned,
                    is_pinned: owned ? owned.is_pinned : false
                };
            });

            return res.status(200).json(awardsWithStatus);
        } catch (error) {
            console.error('Error fetching awards:', error);
            return res.status(500).json({ error: 'Error del servidor' });
        }
    }

    if (req.method === 'POST') {
        const { userId, awardId, action } = req.body;
        if (!userId || !awardId) return res.status(400).json({ error: 'Faltan datos' });

        try {
            if (action === 'toggle-pin') {
                // Verificar que el usuario tenga el premio
                const check = await sql`SELECT id, is_pinned FROM user_awards WHERE user_id = ${userId} AND award_id = ${awardId}`;
                if (check.length === 0) return res.status(403).json({ error: 'No posees este premio' });

                const newPinStatus = !check[0].is_pinned;

                // Si se está anclando, verificar que no supere el límite (ej: 5)
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
        } catch (error) {
            console.error('Error updating award:', error);
            return res.status(500).json({ error: 'Error del servidor' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
};
