-- SQL Optimization Script for OmnisTFG
-- Run this in the Supabase SQL Editor to improve database performance.

-- --- FRIENDSHIPS ---
-- Speeds up friend list fetching and activity feed source selection.
CREATE INDEX IF NOT EXISTS idx_friendships_sender_status ON friendships(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver_status ON friendships(receiver_id, status);

-- --- COMMUNITIES ---
-- Speeds up membership checks and listing members of a community.
CREATE INDEX IF NOT EXISTS idx_community_members_user_comm ON community_members(user_id, community_id);
-- Speeds up member sorting by join date.
CREATE INDEX IF NOT EXISTS idx_community_members_joined_at ON community_members(joined_at);

-- --- MESSAGES ---
-- Speeds up fetching recent messages in a community.
CREATE INDEX IF NOT EXISTS idx_community_messages_comm_created ON community_messages(community_id, created_at DESC);

-- --- GAMES & LIBRARY ---
-- Speeds up user library lookups and value calculations.
CREATE INDEX IF NOT EXISTS idx_user_games_user_id ON user_games(user_id);
-- Speeds up sorting library by purchase date.
CREATE INDEX IF NOT EXISTS idx_user_games_purchase_date ON user_games(purchase_date DESC);

-- --- ACTIVITIES ---
-- Speeds up the social activity feed.
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);

-- --- NOTIFICATIONS ---
-- Speeds up unread notification count (Partial Index).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- --- DIRECT MESSAGES ---
-- Speeds up unread message count (Partial Index).
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_unread ON direct_messages(receiver_id, created_at DESC) WHERE is_read = FALSE;

-- --- AWARDS & PETS ---
-- Speeds up checking if a user owns an award or pet.
CREATE INDEX IF NOT EXISTS idx_user_awards_user_award ON user_awards(user_id, award_id);
CREATE INDEX IF NOT EXISTS idx_user_pets_user_pet ON user_pets(user_id, pet_id);

-- --- USERS ---
-- Speeds up search by username (prefix search).
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
