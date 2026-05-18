const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

function getCloudinaryConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX || 'performance-management',
  };
}

function isCloudinaryConfigured() {
  const config = getCloudinaryConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function sanitizeBaseName(value) {
  return String(value || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

function buildLocalUrl(folder, filename) {
  return '/uploads/' + folder + '/' + filename;
}

async function ensureFolder(folder) {
  const target = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(target, { recursive: true });
  return target;
}

async function storeLocally(file, folder, userId) {
  const targetDir = await ensureFolder(folder);
  const extension = path.extname(file.originalname || '').toLowerCase();
  const filename = [
    sanitizeBaseName(userId || 'user'),
    Date.now(),
    Math.round(Math.random() * 1e9),
  ].join('-') + extension;
  const targetPath = path.join(targetDir, filename);

  await fs.writeFile(targetPath, file.buffer);

  return {
    name: file.originalname,
    url: buildLocalUrl(folder, filename),
    type: 'file',
    size: file.size,
    mimetype: file.mimetype,
    storageProvider: 'local',
    publicId: null,
  };
}

function buildCloudinarySignature(params, apiSecret) {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => key + '=' + params[key])
    .join('&');

  return crypto
    .createHash('sha1')
    .update(serialized + apiSecret)
    .digest('hex');
}

async function storeInCloudinary(file, folder, userId) {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = [sanitizeBaseName(userId || 'user'), Date.now()].join('-');
  const cloudFolder = [config.folderPrefix, folder].join('/');
  const signature = buildCloudinarySignature(
    {
      folder: cloudFolder,
      public_id: publicId,
      timestamp,
    },
    config.apiSecret
  );

  const form = new FormData();
  form.append('file', new Blob([file.buffer]), file.originalname);
  form.append('api_key', config.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', cloudFolder);
  form.append('public_id', publicId);
  form.append('signature', signature);

  const response = await fetch(
    'https://api.cloudinary.com/v1_1/' + config.cloudName + '/auto/upload',
    {
      method: 'POST',
      body: form,
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Cloud upload failed');
  }

  return {
    name: file.originalname,
    url: payload.secure_url,
    type: 'file',
    size: file.size,
    mimetype: file.mimetype,
    storageProvider: 'cloudinary',
    publicId: payload.public_id,
  };
}

async function storeUploadedFile(file, options) {
  const folder = options?.folder || 'misc';
  const userId = options?.userId || 'user';

  if (!file) {
    throw new Error('No file provided');
  }

  if (isCloudinaryConfigured()) {
    return storeInCloudinary(file, folder, userId);
  }

  return storeLocally(file, folder, userId);
}

module.exports = {
  isCloudinaryConfigured,
  storeUploadedFile,
};
