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

-- 7. Fix Pet System (Normalized)
DROP TABLE IF EXISTS user_pets;
DROP TABLE IF EXISTS pets;

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

-- 8. Populate Real Pets
INSERT INTO pets (name, icon_url) VALUES 
('Dragón', '/images/pet_dragon.png'),
('Fox', '/images/pet_fox_sprites.png'),
('Pingüino', '/images/pet_penguin_sprites.png'),
('Bot', '/images/pet_bot.png'),
('Fantasma', '/images/pet_ghost_sprites.png'),
('Bruja', '/images/pet_witch_sprites.png'),
('Mago', '/images/pet_wizard_sprites.png'),
('Hada', '/images/pet_fairy_sprites.png');

-- 9. Unlock Pets for Test User
-- Modify 'test@alpargata.com' if your test user has a different email
INSERT INTO user_pets (user_id, pet_id)
SELECT u.id, p.id FROM users u, pets p
WHERE u.email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;
