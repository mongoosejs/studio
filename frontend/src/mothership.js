'use strict';

const axios = require('axios');
const client = axios.create({
  baseURL: window.MONGOOSE_STUDIO_CONFIG.mothershipUrl
});

console.log('Mothership baseURL:', window.MONGOOSE_STUDIO_CONFIG.mothershipUrl);

client.hasAPIKey = !!window.MONGOOSE_STUDIO_CONFIG.mothershipUrl;

client.interceptors.request.use(req => {
  const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
  if (accessToken) {
    req.headers.authorization = accessToken;
  }

  return req;
});

function sanitizedReturnUrl() {
  const url = new URL(window.location.href);
  if (url.hash && url.hash.includes('?')) {
    const [hashPath, hashSearch] = url.hash.split('?', 2);
    url.hash = hashPath;
  }
  return url.toString();
}

exports.githubLogin = function githubLogin() {
  return client.post('/githubLogin', { state: sanitizedReturnUrl() }).then(res => res.data);
};

exports.googleLogin = function googleLogin() {
  return client.post('/googleLogin', { state: sanitizedReturnUrl() }).then(res => res.data);
};

exports.getWorkspaceTeam = function getWorkspaceTeam() {
  return client.post('/getWorkspaceTeam', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id }).then(res => res.data);
};

exports.getWorkspaceCustomerPortalLink = function getWorkspaceCustomerPortalLink(params) {
  return client.post('/getWorkspaceCustomerPortalLink', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id, ...params }).then(res => res.data);
};

exports.github = function github(code) {
  return client.post('/github', { code, workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id }).then(res => res.data);
};

exports.google = function google(code) {
  return client.post('/google', { code, workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id }).then(res => res.data);
};

exports.inviteToWorkspace = function inviteToWorkspace(params) {
  return client.post('/inviteToWorkspace', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id, ...params }).then(res => res.data);
};

exports.me = function me() {
  return client.post('/me', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id }).then(res => res.data);
};

exports.removeFromWorkspace = function removeFromWorkspace(params) {
  return client.post('/removeFromWorkspace', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id, ...params }).then(res => res.data);
};

exports.updateWorkspaceMember = function updateWorkspaceMember(params) {
  return client.post('/updateWorkspaceMember', { workspaceId: window.MONGOOSE_STUDIO_CONFIG.workspace._id, ...params }).then(res => res.data);
};

exports.hasAPIKey = client.hasAPIKey;
