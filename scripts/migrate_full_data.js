const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });


// CONFIGURACIÓN

// Utilice la antigua URL de Neon aquí. Si es diferente de lo que se muestra a continuación, actualícelo.
// Utilice la URL de Neon UNPOOLED para ver si pasa por alto la restricción de cuota del pooler
const OLD_DATABASE_URL = "postgresql://neondb_owner:npg_k3OPFrbURXc1@ep-odd-paper-ahr2qwqc.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const NEW_DATABASE_URL = process.env.DATABASE_URL;

if (!OLD_DATABASE_URL || !NEW_DATABASE_URL) {
    console.error('Error: Faltan las URLs de las bases de datos.');
    process.exit(1);
}

const sqlOld = postgres(OLD_DATABASE_URL, { ssl: 'require' });
const sqlNew = postgres(NEW_DATABASE_URL, { ssl: 'require' });

// El pedido es CRÍTICO debido a restricciones de clave externa
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
            
            // 1. Obtener datos de la base de datos antigua
            const rows = await sqlOld`SELECT * FROM ${sqlOld(table)}`;
            
            if (rows.length === 0) {
                console.log(`¡Tabla ${table} está vacía, saltando!`);
                continue;
            }

            console.log(`Encontradas ${rows.length} filas en Neon. Insertando en Supabase...`);

            // 2. Insertar en una nueva base de datos
            // Usamos ON CONFLICT DO Nothing para evitar problemas con ejecuciones repetidas.
            // Nota: Esto supone que 'id' es la clave principal para la mayoría de las tablas.
            await sqlNew`
                INSERT INTO ${sqlNew(table)} ${sqlNew(rows)}
                ON CONFLICT DO NOTHING
            `;

            // 3. Restablecer secuencias para columnas SERIAL
            try {
                await sqlNew`
                    SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE(MAX(id), 1)) FROM ${sqlNew(table)}
                `;
            } catch (seqErr) {
                // Es posible que algunas tablas no tengan una 'id' o una secuencia; ignore los errores aquí
            }

            console.log(`✅ Tabla ${table} migrada con éxito.`);
        } catch (err) {
            console.error(`❌ Error migrando tabla ${table}:`, err.message);
            // Continuamos con otras tablas si alguna falla, pero normalmente los errores aquí son críticos.
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
