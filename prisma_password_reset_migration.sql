-- SQL Migration Script for PasswordResetToken Table
-- Execute this manually on your NeonDB if needed

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_ip" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_hash_key" ON "PasswordResetToken"("token_hash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_hash_idx" ON "PasswordResetToken"("token_hash");

-- Foreign Key Constraints
ALTER TABLE "PasswordResetToken" 
ADD CONSTRAINT "PasswordResetToken_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
