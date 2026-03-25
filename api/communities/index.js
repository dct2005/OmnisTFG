const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // Permisos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);


        if (req.method === 'GET') {
            const { userId, myCommunities } = req.query;

            // Si nos piden "Mis Comunidades"
            if (myCommunities === 'true') {
                if (!userId) {
                    return res.status(200).json([]);
                }
                const myComms = await sql`
                    SELECT c.* FROM communities c
                    JOIN community_members cm ON c.id = cm.community_id
                    WHERE cm.user_id = ${userId}
                    ORDER BY c.id DESC
                `;
                return res.status(200).json(myComms);
            }

            // Si no, devolvemos TODAS las comunidades normales
            const allComms = await sql`SELECT * FROM communities ORDER BY id DESC`;
            return res.status(200).json(allComms);
        }

        if (req.method === 'POST') {
            const { name, description, categoria, image_url } = req.body;

            if (!name || !categoria) {
                return res.status(400).json({ error: 'Faltan datos obligatorios' });
            }

            // Insertamos los datos haciendo match con las columnas de tu captura
            const newCommunity = await sql`
                INSERT INTO communities (
                    name, 
                    description, 
                    categoria, 
                    image_url, 
                    is_official, 
                    member_count, 
                    online_count, 
                    total_messages
                )
                VALUES (
                    ${name}, 
                    ${description}, 
                    ${categoria}, 
                    ${image_url}, 
                    FALSE, 
                    0, 
                    0, 
                    0
                )
                RETURNING id, name
            `;

            return res.status(201).json({
                message: 'Comunidad creada con éxito',
                community: newCommunity[0]
            });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error en communities API:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};