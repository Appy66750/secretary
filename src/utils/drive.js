const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
}

async function getTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

async function setCredentials(tokens) {
  oauth2Client.setCredentials(tokens);
}

async function createFolder(name, parentId = null) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const fileMetadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  const res = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });
  return res.data.id;
}

async function uploadFile(filePath, fileName, mimeType, folderId) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };
  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });
  return res.data.id;
}

async function findOrCreateRootFolder(userId) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const query = `name = 'Mail Secretary' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });
  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    return await createFolder('Mail Secretary');
  }
}

async function createSubFolder(name, parentId) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const query = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });
  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    return await createFolder(name, parentId);
  }
}

module.exports = {
  getAuthUrl,
  getTokens,
  setCredentials,
  createFolder,
  uploadFile,
  findOrCreateRootFolder,
  createSubFolder,
};