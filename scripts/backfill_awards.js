const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function grantExisting() {
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('Granting awards to existing users...');
    try {
        const users = await sql`SELECT id FROM users`;
        const awards = await sql`SELECT id, type, requirement FROM awards`;

        for (const user of users) {
            // Games
            const gamesCountQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${user.id}`;
            const gamesCount = parseInt(gamesCountQuery[0].count, 10);
            
            // Communities
            const commsCountQuery = await sql`SELECT COUNT(*) as count FROM community_members WHERE user_id = ${user.id}`;
            const commsCount = parseInt(commsCountQuery[0].count, 10);

            for (const award of awards) {
                const count = award.type === 'games' ? gamesCount : commsCount;
                if (count >= award.requirement) {
                    await sql`
                        INSERT INTO user_awards (user_id, award_id, obtained_at)
                        VALUES (${user.id}, award.id, NOW())
                        ON CONFLICT DO NOTHING
                    `;
                }
            }
        }
        console.log('Backfill completed.');
    } catch (err) {
        console.error('Error in backfill:', err);
    }
}

// Fixed a typo in the above script (award.id vs award.id) and improved it.
// Actually, I'll just write the correct version now.
async function grantExistingCorrect() {
    const sql = neon(process.env.DATABASE_URL);
    console.log('Granting awards to existing users (Corrected)...');
    try {
        const users = await sql`SELECT id FROM users`;
        const awards = await sql`SELECT id, type, requirement FROM awards`;

        for (const user of users) {
            const gamesCountQuery = await sql`SELECT COUNT(*) as count FROM user_games WHERE user_id = ${user.id}`;
            const gamesCount = parseInt(gamesCountQuery[0].count, 10);
            
            const commsCountQuery = await sql`SELECT COUNT(*) as count FROM community_members WHERE user_id = ${user.id}`;
            const commsCount = parseInt(commsCountQuery[0].count, 10);

            for (const award of awards) {
                const count = award.type === 'games' ? gamesCount : (award.type === 'communities' ? commsCount : 0);
                if (count >= award.requirement) {
                    await sql`
                        INSERT INTO user_awards (user_id, award_id, obtained_at)
                        VALUES (${user.id}, ${award.id}, NOW())
                        ON CONFLICT DO NOTHING
                    `;
                }
            }
        }
        console.log('Backfill completed.');
    } catch (err) {
        console.error('Error in backfill:', err);
    }
}

grantExistingCorrect();
