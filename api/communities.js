// api/communities.js
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // Configuración CORS (Igual que en login/register)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido. Usa GET.' });
    }

    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('Falta la variable DATABASE_URL');

        const sql = neon(dbUrl);

        // Consulta: Dame todas las comunidades
        // (Opcional: puedes ordenar por las oficiales primero)
        const communities = await sql`SELECT * FROM communities ORDER BY is_official DESC, created_at DESC`;

        return res.status(200).json(communities);

    } catch (error) {
        console.error('Error al obtener comunidades:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};