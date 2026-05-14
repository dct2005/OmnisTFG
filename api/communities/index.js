const { getSql } = require('../../lib/db');

module.exports = async function handler(req, res) {
    let sql;
    try {
        sql = getSql();
    } catch (err) {
        return res.status(500).json({ error: 'Configuración de base de datos incorrecta' });
    }

    // Permisos CORAZONES
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {


        if (req.method === 'GET') {
            const { userId, myCommunities } = req.query;

            // Si nos piden "Mis Comunidades"
            if (myCommunities === 'true') {
                if (!userId) {
                    return res.status(200).json([]);
                }
                const myComms = await sql`
                    SELECT c.id, c.name, c.description, c.image_url, c.categoria, c.member_count, c.online_count, c.is_official
                    FROM communities c
                    JOIN community_members cm ON c.id = cm.community_id
                    WHERE cm.user_id = ${userId}
                    ORDER BY c.id DESC
                `;
                return res.status(200).json(myComms);
            }

            // Si no, devolvemos TODAS las comunidades normales
            const allComms = await sql`
                SELECT id, name, description, image_url, categoria, member_count, online_count, is_official 
                FROM communities 
                ORDER BY id DESC
            `;
            return res.status(200).json(allComms);
        }

        if (req.method === 'POST') {
            const { action, name, description, categoria, image_url, userId } = req.body;

            // Acción: Crear Comunidad
            if (action === 'create' || !action) {
                if (!name || !categoria) {
                    return res.status(400).json({ error: 'Faltan datos obligatorios' });
                }

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
                        1, 
                        0, 
                        0
                    )
                    RETURNING id, name
                `;

                const communityId = newCommunity[0].id;

                if (userId) {
                    await sql`
                        INSERT INTO community_members (user_id, community_id, joined_at, role)
                        VALUES (${userId}, ${communityId}, NOW(), 'administrador')
                    `;
                }

                return res.status(201).json({
                    message: 'Comunidad creada con éxito',
                    community: newCommunity[0]
                });
            }

            // Acción: Actualizar Comunidad
            if (action === 'update') {
                const { id, name, description, categoria } = req.body;
                if (!id) return res.status(400).json({ error: 'Falta el ID de la comunidad' });

                const updated = await sql`
                    UPDATE communities 
                    SET name = ${name}, description = ${description}, categoria = ${categoria}
                    WHERE id = ${id}
                    RETURNING id, name, description, categoria
                `;

                if (updated.length === 0) return res.status(404).json({ error: 'Comunidad no encontrada' });

                return res.status(200).json({
                    message: 'Comunidad actualizada con éxito',
                    community: updated[0]
                });
            }
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error en communities API:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};