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

-- 7. Fix User Pets Table
DROP TABLE IF EXISTS user_pets;
CREATE TABLE user_pets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pet_name TEXT,
    rarity TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Unlock Pets for Test User
-- Modify 'javieer@gmail.com' if your test user has a different email
INSERT INTO user_pets (user_id, pet_name, rarity, image_url)
SELECT id, 'Fénix de Fuego', 'rare', '/assets/pets/fénix-de-fuego.png' FROM users WHERE email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_pets (user_id, pet_name, rarity, image_url)
SELECT id, 'Dragón de Escarcha', 'rare', '/assets/pets/dragón-de-escarcha.png' FROM users WHERE email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_pets (user_id, pet_name, rarity, image_url)
SELECT id, 'Tigre de Trueno', 'rare', '/assets/pets/tigre-de-trueno.png' FROM users WHERE email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_pets (user_id, pet_name, rarity, image_url)
SELECT id, 'Gato Galáctico', 'rare', '/assets/pets/gato-galáctico.png' FROM users WHERE email = 'test@alpargata.com'
ON CONFLICT DO NOTHING;
