const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getSecret() {
  const secret = process.env.CALENDAR_TOKEN_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    throw new Error('CALENDAR_TOKEN_SECRET is not configured');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

exports.encryptValue = function encryptValue(value) {
  if (!value) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
};

exports.decryptValue = function decryptValue(payload) {
  if (!payload) return '';

  const parts = String(payload).split('.');
  if (parts.length !== 3) {
    throw new Error('Encrypted calendar token is malformed');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), Buffer.from(parts[0], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[1], 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parts[2], 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};
