const { neon } = require('@neondatabase/serverless');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkAndGrantAwards(userId) {
    // Obtener todos los géneros y temáticas de los juegos que posee el usuario
    const userGamesMetadata = await sql`
        SELECT g.genres, g.themes 
        FROM user_games ug
        JOIN games g ON ug.game_api_id = CAST(g.id AS TEXT)
        WHERE ug.user_id = ${userId}
    `;
    
    const allPlayerGenres = new Set();
    userGamesMetadata.forEach(g => {
        if (g.genres) g.genres.forEach(gen => allPlayerGenres.add(gen));
        if (g.themes) g.themes.forEach(t => allPlayerGenres.add(t));
    });

    const potentialAwards = await sql`
        SELECT * FROM awards 
        WHERE type = 'genre' 
        AND id NOT IN (SELECT award_id FROM user_awards WHERE user_id = ${userId})
    `;

    for (const award of potentialAwards) {
        const requiredGenres = award.requirement.split(',');
        const hasAchievement = requiredGenres.some(req => allPlayerGenres.has(req));
        
        if (hasAchievement) {
            console.log(`Granting award ${award.name} to user ${userId}`);
            await sql`
                INSERT INTO user_awards (user_id, award_id, obtained_at)
                VALUES (${userId}, ${award.id}, NOW())
                ON CONFLICT DO NOTHING
            `;
        }
    }
}

async function run() {
    console.log("Starting genre backfill...");

    // 1. Obtener todos los IDs de juegos únicos en user_games
    const gameIdsResult = await sql`SELECT DISTINCT game_api_id FROM user_games`;
    const gameIds = gameIdsResult.map(r => r.game_api_id);

    console.log(`Found ${gameIds.length} unique games to process.`);

    // 2. Poblar tabla games (metadatos)
    for (const gid of gameIds) {
        try {
            console.log(`Fetching metadata for game ${gid}...`);
            const response = await axios.post(
                "https://api.igdb.com/v4/games",
                `fields name, genres.name, themes.name; where id = ${gid};`,
                {
                    headers: {
                        "Client-ID": process.env.TWITCH_CLIENT_ID,
                        "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                    }
                }
            );

            if (response.data && response.data.length > 0) {
                const g = response.data[0];
                const genres = g.genres ? g.genres.map(gen => gen.name) : [];
                const themes = g.themes ? g.themes.map(t => t.name) : [];
                
                await sql`
                    INSERT INTO games (id, name, genres, themes)
                    VALUES (${g.id}, ${g.name}, ${genres}, ${themes})
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        genres = EXCLUDED.genres,
                        themes = EXCLUDED.themes
                `;
            }
        } catch (err) {
            console.error(`Error processing game ${gid}:`, err.message);
        }
    }

    // 3. Procesar premios para cada usuario
    const usersResult = await sql`SELECT id FROM users`;
    const userIds = usersResult.map(u => u.id);

    console.log(`Processing awards for ${userIds.length} users...`);
    for (const uid of userIds) {
        await checkAndGrantAwards(uid);
    }

    console.log("Backfill completed.");
}

run().catch(console.error);
