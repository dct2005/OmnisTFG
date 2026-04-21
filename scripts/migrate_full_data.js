const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// =============================================================================
// CONFIGURATION
// =============================================================================
// Use the old Neon URL here. If it's different from what's below, please update it.
// Use the UNPOOLED Neon URL to see if it bypasses the pooler's quota restriction
const OLD_DATABASE_URL = "postgresql://neondb_owner:npg_k3OPFrbURXc1@ep-odd-paper-ahr2qwqc.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const NEW_DATABASE_URL = process.env.DATABASE_URL;

if (!OLD_DATABASE_URL || !NEW_DATABASE_URL) {
    console.error('Error: Faltan las URLs de las bases de datos.');
    process.exit(1);
}

const sqlOld = postgres(OLD_DATABASE_URL, { ssl: 'require' });
const sqlNew = postgres(NEW_DATABASE_URL, { ssl: 'require' });

// Order is CRITICAL due to Foreign Key constraints
const TABLES = [
    'users',
    'communities',
    'awards',
    'pets',
    'friendships',
    'user_games',
    'user_wishlist',
    'community_members',
    'community_messages',
    'direct_messages',
    'chat_groups',
    'group_members',
    'group_messages',
    'typing_status',
    'user_awards',
    'user_pets',
    'daily_quests',
    'user_quests',
    'notifications',
    'support_tickets',
    'transactions',
    'profile_comments'
];

async function migrate() {
    console.log('🚀 Iniciando migración completa de datos...');

    for (const table of TABLES) {
        try {
            console.log(`\n--- Migrando tabla: ${table} ---`);
            
            // 1. Fetch data from old DB
            const rows = await sqlOld`SELECT * FROM ${sqlOld(table)}`;
            
            if (rows.length === 0) {
                console.log(`¡Tabla ${table} está vacía, saltando!`);
                continue;
            }

            console.log(`Encontradas ${rows.length} filas en Neon. Insertando en Supabase...`);

            // 2. Insert into new DB
            // We use ON CONFLICT DO NOTHING to avoid issues with repeated runs
            // Note: This assumes 'id' is the primary key for most tables
            await sqlNew`
                INSERT INTO ${sqlNew(table)} ${sqlNew(rows)}
                ON CONFLICT DO NOTHING
            `;

            // 3. Reset sequences for SERIAL columns
            try {
                await sqlNew`
                    SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE(MAX(id), 1)) FROM ${sqlNew(table)}
                `;
            } catch (seqErr) {
                // Some tables might not have an 'id' or a sequence, ignore errors here
            }

            console.log(`✅ Tabla ${table} migrada con éxito.`);
        } catch (err) {
            console.error(`❌ Error migrando tabla ${table}:`, err.message);
            // We continue with other tables if one fails, but usually errors here are critical
        }
    }

    console.log('\n=============================================================');
    console.log('🎉 ¡Migración finalizada!');
    console.log('Recuerda verificar tus datos en el dashboard de Supabase.');
    console.log('=============================================================');
    
    await sqlOld.end();
    await sqlNew.end();
}

migrate();
