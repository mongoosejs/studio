'use strict';

const axios = require('axios');
const client = axios.create({
  baseURL: config__mothershipUrl
});

client.hasAPIKey = !!config__mothershipUrl;

client.interceptors.request.use(req => {
  const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
  if (accessToken) {
    req.headers.authorization = accessToken;
  }

  return req;
});

exports.githubLogin = function githubLogin() {
  return client.post('/githubLogin', { state: window.location.href }).then(res => res.data);
};

exports.getWorkspaceTeam = function getWorkspaceTeam() {
  return client.post('/getWorkspaceTeam', { workspaceId: config__workspace._id }).then(res => res.data);
};

exports.getWorkspaceCustomerPortalLink = function getWorkspaceCustomerPortalLink(params) {
  return client.post('/getWorkspaceCustomerPortalLink', { workspaceId: config__workspace._id, ...params }).then(res => res.data);
};

exports.github = function github(code) {
  return client.post('/github', { code, workspaceId: config__workspace._id }).then(res => res.data);
};

exports.inviteToWorkspace = function inviteToWorkspace(params) {
  return client.post('/inviteToWorkspace', { workspaceId: config__workspace._id, ...params }).then(res => res.data);
};

exports.me = function me() {
  return client.post('/me', { workspaceId: config__workspace._id }).then(res => res.data);
};

exports.removeFromWorkspace = function removeFromWorkspace(params) {
  return client.post('/removeFromWorkspace', { workspaceId: config__workspace._id, ...params }).then(res => res.data);
};

exports.hasAPIKey = client.hasAPIKey;
