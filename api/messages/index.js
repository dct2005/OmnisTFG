const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = neon(process.env.DATABASE_URL);
        const { action } = req.query;

        if (req.method === 'GET') {
            // Obtener lista de conversaciones (usuarios con los que se ha hablado)
            if (action === 'get-conversations') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                // Esta consulta obtiene los usuarios que han enviado o recibido mensajes de userId
                // y el último mensaje de cada conversación
                const conversations = await sql`
                    WITH last_messages AS (
                        SELECT 
                            CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END as other_user_id,
                            content,
                            created_at,
                            is_read,
                            sender_id,
                            ROW_NUMBER() OVER(PARTITION BY CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END ORDER BY created_at DESC) as rn
                        FROM direct_messages
                        WHERE sender_id = ${userId} OR receiver_id = ${userId}
                    )
                    SELECT 
                        u.id, u.username, u.profile_image, 
                        lm.content as last_message, 
                        lm.created_at as time,
                        lm.is_read,
                        lm.sender_id
                    FROM last_messages lm
                    JOIN users u ON u.id = lm.other_user_id
                    WHERE lm.rn = 1
                    ORDER BY lm.created_at DESC
                `;
                return res.status(200).json(conversations);
            }

            // Obtener el chat completo entre dos usuarios
            if (action === 'get-chat') {
                const { user1, user2 } = req.query;
                if (!user1 || !user2) return res.status(400).json({ error: 'Faltan IDs de usuario' });

                const messages = await sql`
                    SELECT m.*, u.username as sender_name
                    FROM direct_messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE (sender_id = ${user1} AND receiver_id = ${user2})
                       OR (sender_id = ${user2} AND receiver_id = ${user1})
                    ORDER BY created_at ASC
                `;
                return res.status(200).json(messages);
            }

            // Obtener mensajes no leídos para notificaciones
            if (action === 'get-unread-messages') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const unread = await sql`
                    SELECT m.*, u.username as sender_name, u.profile_image as sender_image
                    FROM direct_messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE receiver_id = ${userId} AND is_read = FALSE
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(unread);
            }
        }

        if (req.method === 'POST') {
            // Enviar un mensaje
            if (action === 'send') {
                const { senderId, receiverId, content, imageUrl } = req.body;
                if (!senderId || !receiverId || (!content && !imageUrl)) {
                    return res.status(400).json({ error: 'Faltan datos obligatorios' });
                }

                // Asegurar columna image_url si no existe (Neon soporta IF NOT EXISTS)
                try {
                    await sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT`;
                } catch (e) {
                    console.error('Error asegurando columna image_url:', e);
                }

                const newMessage = await sql`
                    INSERT INTO direct_messages (sender_id, receiver_id, content, image_url)
                    VALUES (${senderId}, ${receiverId}, ${content || ''}, ${imageUrl || null})
                    RETURNING *
                `;
                return res.status(201).json(newMessage[0]);
            }

            // Marcar mensajes como leídos
            if (action === 'mark-read') {
                const { userId, otherId } = req.body;
                if (!userId || !otherId) return res.status(400).json({ error: 'Faltan datos' });

                await sql`
                    UPDATE direct_messages
                    SET is_read = TRUE
                    WHERE receiver_id = ${userId} AND sender_id = ${otherId} AND is_read = FALSE
                `;
                return res.status(200).json({ success: true });
            }
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error en API de mensajes:', error);
        return res.status(500).json({ error: 'Error del servidor', details: error.message });
    }
};
