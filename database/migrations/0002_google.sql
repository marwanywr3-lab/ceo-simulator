CREATE TABLE oauth_identities(provider TEXT NOT NULL CHECK(provider='google'),subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(provider,subject));
CREATE TABLE auth_challenges(id TEXT PRIMARY KEY,nonce TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL);
