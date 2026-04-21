const postgres = require('postgres');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
        const { action } = req.query;

        // Asegurar tablas necesarias
        try {
            await sql`CREATE TABLE IF NOT EXISTS typing_status (
                user_id INTEGER PRIMARY KEY,
                conversation_with INTEGER,
                last_typed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;
            
            // Tablas de Grupos
            await sql`CREATE TABLE IF NOT EXISTS chat_groups (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )`;
            
            await sql`CREATE TABLE IF NOT EXISTS group_members (
                group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (group_id, user_id)
            )`;
            
            await sql`CREATE TABLE IF NOT EXISTS group_messages (
                id SERIAL PRIMARY KEY,
                group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id),
                content TEXT,
                image_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )`;
        } catch (e) { console.error('Error creando tablas de mensajes/grupos:', e); }

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

            if (action === 'get-groups') {
                const { userId } = req.query;
                if (!userId) return res.status(400).json({ error: 'Falta userId' });

                const groups = await sql`
                    SELECT 
                        g.*, 
                        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                        (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
                        (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
                    FROM chat_groups g
                    JOIN group_members gm ON g.id = gm.group_id
                    WHERE gm.user_id = ${userId}
                    ORDER BY last_message_time DESC NULLS LAST, g.created_at DESC
                `;
                return res.status(200).json(groups);
            }

            if (action === 'get-group-chat') {
                const { groupId } = req.query;
                if (!groupId) return res.status(400).json({ error: 'Falta groupId' });

                const messages = await sql`
                    SELECT gm.*, u.username as sender_name, u.profile_image as sender_image
                    FROM group_messages gm
                    JOIN users u ON gm.sender_id = u.id
                    WHERE gm.group_id = ${groupId}
                    ORDER BY gm.created_at ASC
                `;
                return res.status(200).json(messages);
            }

            if (action === 'get-group-members') {
                const { groupId } = req.query;
                if (!groupId) return res.status(400).json({ error: 'Falta groupId' });

                const members = await sql`
                    SELECT u.id, u.username, u.profile_image, u.estado, u.current_activity
                    FROM group_members gm
                    JOIN users u ON gm.user_id = u.id
                    WHERE gm.group_id = ${groupId}
                `;
                return res.status(200).json(members);
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

            // Verificar si el otro usuario está escribiendo
            if (action === 'get-typing') {
                const { userId, otherId } = req.query;
                if (!userId || !otherId) return res.status(400).json({ error: 'Faltan parámetros' });

                const typing = await sql`
                    SELECT user_id 
                    FROM typing_status 
                    WHERE user_id = ${otherId} 
                      AND conversation_with = ${userId} 
                      AND last_typed_at > NOW() - INTERVAL '4 seconds'
                `;
                return res.status(200).json({ isTyping: typing.length > 0 });
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

                // 2. Insertar notificación para el receptor
                try {
                    const sender = await sql`SELECT username FROM users WHERE id = ${senderId}`;
                    const senderName = sender[0]?.username || 'Alguien';
                    
                    await sql`
                        INSERT INTO notifications (user_id, type, title, message, link)
                        VALUES (
                            ${receiverId}, 
                            'message', 
                            'Nuevo mensaje', 
                            ${'Has recibido un mensaje de ' + senderName}, 
                            ${'/mensajes?userId=' + senderId}
                        )
                    `;
                } catch (e) {
                    console.error('Error insertando notificación de mensaje:', e);
                }

                return res.status(201).json(newMessage[0]);
            }

            if (action === 'create-group') {
                const { name, creatorId, memberIds } = req.body;
                if (!name || !creatorId || !memberIds || !Array.isArray(memberIds)) {
                    return res.status(400).json({ error: 'Faltan datos para el grupo' });
                }

                // 1. Crear el grupo
                const [group] = await sql`
                    INSERT INTO chat_groups (name, created_by)
                    VALUES (${name}, ${creatorId})
                    RETURNING *
                `;

                // 2. Añadir miembros
                const allMembers = [creatorId, ...memberIds];
                for (const uid of allMembers) {
                    await sql`
                        INSERT INTO group_members (group_id, user_id)
                        VALUES (${group.id}, ${uid})
                        ON CONFLICT DO NOTHING
                    `;
                    
                    // Notificar a los miembros (excepto al creador)
                    if (uid !== creatorId) {
                        const creator = await sql`SELECT username FROM users WHERE id = ${creatorId}`;
                        await sql`
                            INSERT INTO notifications (user_id, type, title, message, link)
                            VALUES (
                                ${uid}, 
                                'group_invite', 
                                'Nuevo grupo', 
                                ${creator[0].username + ' te ha añadido al grupo: ' + name}, 
                                ${'/mensajes?groupId=' + group.id}
                            )
                        `;
                    }
                }

                return res.status(201).json(group);
            }

            if (action === 'send-group-message') {
                const { groupId, senderId, content, imageUrl } = req.body;
                if (!groupId || !senderId || (!content && !imageUrl)) {
                    return res.status(400).json({ error: 'Faltan datos' });
                }

                const [msg] = await sql`
                    INSERT INTO group_messages (group_id, sender_id, content, image_url)
                    VALUES (${groupId}, ${senderId}, ${content || ''}, ${imageUrl || null})
                    RETURNING *
                `;

                // Añadir nombre del emisor para la UI inmediata
                const sender = await sql`SELECT username, profile_image FROM users WHERE id = ${senderId}`;
                return res.status(201).json({ 
                    ...msg, 
                    sender_name: sender[0].username, 
                    sender_image: sender[0].profile_image 
                });
            }

            // Actualizar estado de "escribiendo"
            if (action === 'set-typing') {
                const { userId, otherId, isTyping } = req.body;
                if (!userId || !otherId) return res.status(400).json({ error: 'Faltan datos' });

                if (isTyping) {
                    await sql`
                        INSERT INTO typing_status (user_id, conversation_with, last_typed_at)
                        VALUES (${userId}, ${otherId}, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id) DO UPDATE 
                        SET conversation_with = EXCLUDED.conversation_with, 
                            last_typed_at = CURRENT_TIMESTAMP
                    `;
                } else {
                    await sql`DELETE FROM typing_status WHERE user_id = ${userId}`;
                }
                return res.status(200).json({ success: true });
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
