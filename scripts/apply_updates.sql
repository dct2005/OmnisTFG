-- UPDATES FOR EXISTING SUPABASE INSTANCE
-- Run this if you have already created the tables using an older version of full_schema.sql

-- 1. Users Table Columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_group_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_game_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_profile TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_games TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_inventory TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_comments TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_badge_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_comments_type TEXT DEFAULT 'community';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme_color TEXT DEFAULT '#00f2ff';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg_color TEXT DEFAULT '#00f2ff';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_name_color TEXT DEFAULT '#ffffff';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_music_url TEXT DEFAULT NULL;

-- 2. Support Tickets Columns
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS game_api_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_response TEXT;

-- 3. Community Messages Columns
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 4. Friendships Columns
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 5. Missing Tables (if not already there)
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    target_id TEXT,
    target_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_api_id TEXT NOT NULL,
    game_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    genres TEXT[],
    themes TEXT[],
    summary TEXT,
    cover_url TEXT,
    rating DECIMAL,
    rating_count INTEGER
);

-- 7. Fix Pet and Award System (Normalized)
DROP TABLE IF EXISTS user_pets;
DROP TABLE IF EXISTS user_awards;
DROP TABLE IF EXISTS pets;
DROP TABLE IF EXISTS awards;

CREATE TABLE awards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    requirement TEXT NOT NULL,
    rarity VARCHAR(50) DEFAULT 'common'
);

CREATE TABLE user_awards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE,
    obtained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_pinned BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, award_id)
);

CREATE TABLE pets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    award_id INTEGER REFERENCES awards(id),
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_pets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pet_id)
);

-- 8. Seed Original Awards (Insignias & Géneros)
INSERT INTO awards (name, description, icon_url, type, requirement, rarity) VALUES 
('Novato de Élite', 'Conseguida tras comprar 1 juego.', '/images/ins_nonecesito.png', 'games', '1', 'common'),
('Borracho de Época', 'Conseguida tras comprar 3 juegos.', '/images/ins_borracho.png', 'games', '3', 'rare'),
('Cuñao Honorario', 'Conseguida tras comprar 5 juegos.', '/images/ins_cunado.png', 'games', '5', 'rare'),
('Cállese y Tome mi Dinero', 'Conseguida tras comprar 7 juegos.', '/images/ins_callese.png', 'games', '7', 'epic'),
('Frozen Mind Legend', 'Conseguida tras comprar 10 juegos.', '/images/ins_frozenmind.png', 'games', '10', 'legendary'),
('Pilar de la Comunidad', 'Conseguida al unirse a 1 comunidad.', '/images/pilar_comunidad.png', 'communities', '1', 'common'),
('Líder de Masas', 'Conseguida al unirse a 5 comunidades.', '/images/lider_masas.png', 'communities', '5', 'epic'),
('Guerrero de Acción', 'Te encantan los desafíos rápidos.', '/images/trophy_action.png', 'genre', 'Action', 'rare'),
('Maestro del Rol', 'Vives mil vidas en una.', '/images/trophy_rpg.png', 'genre', 'RPG', 'epic'),
('Estratega Supremo', 'Tu mente es tu mejor arma.', '/images/trophy_strategy.png', 'genre', 'Strategy', 'epic'),
('Rey de las Recreativas', 'Un clásico nunca muere.', '/images/trophy_arcade.png', 'genre', 'Arcade', 'common'),
('Superviviente Nato', 'A la muerte le dices: hoy no.', '/images/trophy_survival.png', 'genre', 'Survival', 'rare'),
('Piloto de Élite', 'La velocidad corre por tus venas.', '/images/trophy_racing.png', 'genre', 'Racing', 'common'),
('Caminante del Espacio', 'El futuro ya está aquí.', '/images/trophy_scifi.png', 'genre', 'Sci-Fi', 'rare'),
('Sombra en la Noche', 'El miedo no te detiene.', '/images/trophy_horror.png', 'genre', 'Horror', 'epic');

-- 9. Seed Original Pets
INSERT INTO pets (name, icon_url) VALUES 
('Dragón Azul', '/images/pet_dragon_sprites.png'),
('Fantasmitu', '/images/pet_ghost_sprites.png'),
('Mago Arcano', '/images/pet_wizard_sprites.png'),
('Brujita', '/images/pet_witch_sprites.png'),
('Zorrito', '/images/pet_fox_sprites.png'),
('Pingüino', '/images/pet_penguin_sprites.png');

-- 10. Unlock Everything for Test User (test@alpargata.com)
INSERT INTO user_awards (user_id, award_id, is_pinned)
SELECT u.id, a.id, CASE WHEN a.id <= 5 THEN TRUE ELSE FALSE END 
FROM users u, awards a
WHERE u.email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_pets (user_id, pet_id)
SELECT u.id, p.id FROM users u, pets p
WHERE u.email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;

-- 11. Create Admin User
INSERT INTO users (username, email, password, peppix, estado, role)
VALUES ('admin', 'admin@omnis.com', '$2b$10$HUptpzlCdVRtThOojPuT5.6wY71VK/4AsbQZu/NEmWA53F9jPVig2', 0, 'en-linea', 'administrador')
ON CONFLICT (email) DO NOTHING;
