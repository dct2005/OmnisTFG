const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('Creating tables...');
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS awards (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                icon_url VARCHAR(255),
                type VARCHAR(50) NOT NULL,
                requirement INTEGER NOT NULL,
                rarity VARCHAR(50) DEFAULT 'common'
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS user_awards (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE,
                obtained_at TIMESTAMP DEFAULT NOW(),
                is_pinned BOOLEAN DEFAULT FALSE,
                UNIQUE(user_id, award_id)
            );
        `;

        console.log('Seeding awards...');
        const initialAwards = [
            { name: 'Novato de Élite', desc: 'Conseguida tras comprar 1 juego.', icon: 'images/ins_nonecesito.png', type: 'games', req: 1, rarity: 'common' },
            { name: 'Borracho de Época', desc: 'Conseguida tras comprar 3 juegos.', icon: 'images/ins_borracho.png', type: 'games', req: 3, rarity: 'rare' },
            { name: 'Cuñao Honorario', desc: 'Conseguida tras comprar 5 juegos.', icon: 'images/ins_cunado.png', type: 'games', req: 5, rarity: 'rare' },
            { name: 'Cállese y Tome mi Dinero', desc: 'Conseguida tras comprar 7 juegos.', icon: 'images/ins_callese.png', type: 'games', req: 7, rarity: 'epic' },
            { name: 'Frozen Mind Legend', desc: 'Conseguida tras comprar 10 juegos.', icon: 'images/ins_frozenmind.png', type: 'games', req: 10, rarity: 'legendary' },
            { name: 'Pilar de la Comunidad', desc: 'Conseguida al unirse a 1 comunidad.', icon: 'images/pilar_comunidad.png', type: 'communities', req: 1, rarity: 'common' },
            { name: 'Líder de Masas', desc: 'Conseguida al unirse a 5 comunidades.', icon: 'images/lider_masas.png', type: 'communities', req: 5, rarity: 'epic' }
        ];

        for (const award of initialAwards) {
            await sql`
                INSERT INTO awards (name, description, icon_url, type, requirement, rarity)
                VALUES (${award.name}, ${award.desc}, ${award.icon}, ${award.type}, ${award.req}, ${award.rarity})
                ON CONFLICT DO NOTHING
            `;
        }

        console.log('Migration and seeding completed successfully.');
    } catch (err) {
        console.error('Error in migration:', err);
    }
}

migrate();
