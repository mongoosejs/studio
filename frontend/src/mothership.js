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

exports.github = function github(code) {
  return client.post('/github', { code }).then(res => res.data);
};

exports.me = function me() {
  return client.post('/me', {}).then(res => res.data);
};

exports.hasAPIKey = client.hasAPIKey;
