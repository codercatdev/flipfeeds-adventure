-- FlipFeeds Auth Schema for Cloudflare D1
-- better-auth manages the core tables (user, session, account)
-- We add custom fields via better-auth's additionalFields config

-- better-auth will create these tables automatically on first use:
-- - user (id, name, email, emailVerified, image, avatarConfig, signalStrength, createdAt, updatedAt)
-- - session (id, expiresAt, token, ipAddress, userAgent, userId)
-- - account (id, accountId, providerId, userId, accessToken, refreshToken, ...)

-- Custom indexes for our queries
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
