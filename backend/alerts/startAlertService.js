'use strict';

const crypto = require('crypto');
const { renderTemplate, notifySlack } = require('./alertUtils');

module.exports = function startAlertService({ db, studioConnection, options, changeStream }) {
  if (!changeStream) {
    return null;
  }

  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';
  const Alert = studioConnection.model('__Studio_Alert');
  const leaseCollection = studioConnection.collection('studio__alertLeases');
  const ownerId = crypto.randomUUID();
  const leaseKey = 'change-stream-alerts';
  const leaseDurationMs = 60000;
  const leaseRefreshMs = 20000;
  const alertRefreshMs = 30000;
  let isLeader = false;
  let alertsCache = [];
  const queue = [];
  let processing = false;

  async function refreshLease() {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseDurationMs);
    const result = await leaseCollection.findOneAndUpdate(
      {
        key: leaseKey,
        $or: [{ expiresAt: { $lt: now } }, { ownerId }]
      },
      {
        $set: {
          key: leaseKey,
          ownerId,
          expiresAt
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    isLeader = result?.value?.ownerId === ownerId;
  }

  async function refreshAlerts() {
    alertsCache = await Alert.find({ enabled: true }).lean();
  }

  function isAlertMatch(alert, change) {
    const namespace = change.ns || {};
    if (alert.database && alert.database !== namespace.db) {
      return false;
    }
    if (alert.collection && alert.collection !== namespace.coll) {
      return false;
    }

    const operation = change.operationType;
    if (alert.eventType === 'upsert') {
      return ['insert', 'update', 'replace'].includes(operation);
    }
    if (alert.eventType === 'update') {
      return ['update', 'replace'].includes(operation);
    }
    return alert.eventType === operation;
  }

  async function processQueue() {
    if (processing) {
      return;
    }
    processing = true;
    try {
      while (queue.length > 0) {
        const change = queue.shift();
        if (!isLeader) {
          continue;
        }
        const matchingAlerts = alertsCache.filter(alert => isAlertMatch(alert, change));
        if (matchingAlerts.length === 0) {
          continue;
        }

        const doc = change.fullDocument || { _id: change.documentKey?._id };
        const payloadDoc = {
          ...doc,
          _id: doc?._id ? String(doc._id) : doc?._id,
          studioLink: options?.studioBaseUrl ? `${options.studioBaseUrl}` : ''
        };

        for (const alert of matchingAlerts) {
          const text = renderTemplate(alert.templateText, payloadDoc);
          await notifySlack({
            mothershipUrl,
            payload: {
              workspaceId: alert.workspaceId,
              channel: alert.slackChannel,
              template: alert.templateText,
              text,
              sampleDocument: payloadDoc,
              eventType: change.operationType,
              database: change.ns?.db,
              collection: change.ns?.coll
            }
          });
        }
      }
    } catch (error) {
      console.warn('[alerts] error processing change stream', error);
    } finally {
      processing = false;
    }
  }

  function handleChange(change) {
    queue.push(change);
    processQueue();
  }

  async function bootstrap() {
    await refreshLease();
    await refreshAlerts();
    setInterval(async () => {
      try {
        await refreshLease();
      } catch (error) {
        isLeader = false;
      }
    }, leaseRefreshMs);
    setInterval(async () => {
      try {
        await refreshAlerts();
      } catch (error) {
        // ignore refresh errors
      }
    }, alertRefreshMs);
  }

  bootstrap().catch(err => console.warn('[alerts] failed to start alert service', err));

  changeStream.on('change', handleChange);

  return {
    stop() {
      changeStream.off('change', handleChange);
    }
  };
};
