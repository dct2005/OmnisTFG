const { getSql } = require('../lib/db');

async function test() {
    try {
        const sql = getSql();
        const users = await sql`SELECT id, email, peppix, last_daily_reward FROM users LIMIT 1`;
        if (users.length === 0) {
            console.log('No users found.');
            process.exit(0);
        }
        
        const user = users[0];
        console.log('Testing with user:', user.email, 'Current Peppix:', user.peppix, 'Last Reward:', user.last_daily_reward);
        
        // Let's call the logic
        const check = await sql`SELECT last_daily_reward, peppix FROM users WHERE email = ${user.email}`;
        console.log('check result:', check);
        
        const lastReward = check[0].last_daily_reward;
        if (lastReward && new Date(lastReward).toDateString() === new Date().toDateString()) {
            console.log('Ya ha reclamado hoy.');
            // Let's reset it for testing
            await sql`UPDATE users SET last_daily_reward = NULL WHERE email = ${user.email}`;
            console.log('Reseteado last_daily_reward. Ejecuta de nuevo el test.');
            process.exit(0);
        }

        const prizes = [
            { type: 'peppix', value: 50, label: '50 Peppix', weight: 35 },
            { type: 'nada', value: 0, label: 'Nada', weight: 100 }
        ];
        
        let prize = prizes[0]; // Force a Peppix prize
        
        console.log('Updating last_daily_reward...');
        await sql`UPDATE users SET last_daily_reward = NOW() WHERE email = ${user.email}`;
        
        console.log('Updating peppix...');
        const currentPeppix = typeof check[0].peppix === 'string' ? parseInt(check[0].peppix.replace(/\./g, ''), 10) : (check[0].peppix || 0);
        const newPeppix = currentPeppix + prize.value;
        await sql`UPDATE users SET peppix = ${newPeppix} WHERE email = ${user.email}`;
        
        console.log('Inserting transaction...');
        await sql`
            INSERT INTO transactions (user_id, peppix_amount, real_money_euro, payment_method)
            SELECT id, ${prize.value}, 0, 'Recompensa Diaria'
            FROM users WHERE email = ${user.email}
        `;
        
        console.log('Done! Verify if peppix updated.');
        const checkAfter = await sql`SELECT peppix, last_daily_reward FROM users WHERE email = ${user.email}`;
        console.log('After update:', checkAfter[0]);
        
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

test();
