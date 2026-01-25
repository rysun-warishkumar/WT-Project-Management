#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Secure Secrets for Production\n');
console.log('='.repeat(60));

// Generate JWT Secret (32 bytes = 64 hex characters)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('\n📝 JWT_SECRET (32+ characters):');
console.log(jwtSecret);

// Generate Credential Encryption Key (32 bytes = 64 hex characters)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('\n🔑 CREDENTIAL_ENCRYPTION_KEY (64-character hex):');
console.log(encryptionKey);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Copy these values to your Render environment variables');
console.log('⚠️  Keep these secrets secure and never commit them to Git!\n');
