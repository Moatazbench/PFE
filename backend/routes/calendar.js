const crypto = require('crypto');
const express = require('express');
const auth = require('../middleware/auth');
const CalendarConnection = require('../models/CalendarConnection');
const { encryptValue, decryptValue } = require('../utils/calendarCrypto');

const router = express.Router();

function getFrontendBaseUrl(req) {
  return process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.headers.origin || 'http://localhost:5173';
}

function getProviderConfig(provider) {
  if (provider === 'google') {
    return {
      provider,
      label: 'Google Calendar',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(' '),
    };
  }

  if (provider === 'outlook') {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    return {
      provider,
      label: 'Outlook',
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || '',
      authorizeUrl: 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token',
      scope: ['offline_access', 'openid', 'profile', 'email', 'Calendars.Read', 'Calendars.ReadWrite'].join(' '),
    };
  }

  return null;
}

function isProviderConfigured(config) {
  return Boolean(config?.clientId && config?.clientSecret && config?.redirectUri);
}

function signState(payload) {
  const secret = process.env.CALENDAR_OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'calendar-oauth-state';
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + signature;
}

function verifyState(token) {
  const secret = process.env.CALENDAR_OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'calendar-oauth-state';
  const parts = String(token || '').split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid calendar OAuth state');
  }

  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (expected !== parts[1]) {
    throw new Error('Calendar OAuth state signature mismatch');
  }

  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (!payload?.provider || !payload?.userId || !payload?.exp || payload.exp < Date.now()) {
    throw new Error('Calendar OAuth state expired');
  }

  return payload;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload?.error_description || payload?.error?.message || payload?.error || 'Calendar provider request failed';
    throw new Error(message);
  }

  return payload;
}

async function exchangeCode(provider, code) {
  const config = getProviderConfig(provider);
  if (!isProviderConfigured(config)) {
    throw new Error(config?.label ? config.label + ' is not configured' : 'Calendar provider is not configured');
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
    grant_type: 'authorization_code',
  });

  if (provider === 'outlook') {
    body.set('scope', config.scope);
  }

  return requestJson(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function refreshConnection(connection) {
  if (!connection?.refreshToken) {
    throw new Error('Calendar refresh token is unavailable');
  }

  const config = getProviderConfig(connection.provider);
  const refreshToken = decryptValue(connection.refreshToken);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  if (config.redirectUri) body.set('redirect_uri', config.redirectUri);
  if (connection.provider === 'outlook') body.set('scope', config.scope);

  const payload = await requestJson(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  connection.accessToken = encryptValue(payload.access_token);
  if (payload.refresh_token) {
    connection.refreshToken = encryptValue(payload.refresh_token);
  }
  if (payload.expires_in) {
    connection.expiresAt = new Date(Date.now() + Number(payload.expires_in) * 1000);
  }
  connection.scope = payload.scope || connection.scope;
  await connection.save();
  return decryptValue(connection.accessToken);
}

async function getAccessToken(connection) {
  const expiresAt = connection?.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
  if (expiresAt && expiresAt > Date.now() + 60 * 1000) {
    return decryptValue(connection.accessToken);
  }

  return refreshConnection(connection);
}

async function fetchProfile(provider, accessToken) {
  if (provider === 'google') {
    return requestJson('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
  }

  return requestJson('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
}

function normalizeGoogleEvents(payload) {
  return (payload?.items || []).map(function (event) {
    return {
      id: event.id,
      provider: 'google',
      title: event.summary || 'Untitled event',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      status: event.status || 'confirmed',
      source: 'provider',
      url: event.htmlLink || '',
    };
  });
}

function normalizeOutlookEvents(payload) {
  return (payload?.value || []).map(function (event) {
    return {
      id: event.id,
      provider: 'outlook',
      title: event.subject || 'Untitled event',
      description: event.bodyPreview || '',
      start: event.start?.dateTime,
      end: event.end?.dateTime,
      location: event.location?.displayName || '',
      status: event.showAs || 'busy',
      source: 'provider',
      url: event.webLink || '',
    };
  });
}

async function fetchRemoteEvents(connection, rangeStart, rangeEnd) {
  const accessToken = await getAccessToken(connection);

  if (connection.provider === 'google') {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', new Date(rangeStart).toISOString());
    url.searchParams.set('timeMax', new Date(rangeEnd).toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');

    const payload = await requestJson(url.toString(), {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    return normalizeGoogleEvents(payload);
  }

  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
  url.searchParams.set('startDateTime', new Date(rangeStart).toISOString());
  url.searchParams.set('endDateTime', new Date(rangeEnd).toISOString());
  url.searchParams.set('$top', '50');
  url.searchParams.set('$orderby', 'start/dateTime');

  const payload = await requestJson(url.toString(), {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  return normalizeOutlookEvents(payload);
}

async function createRemoteEvent(connection, input) {
  const accessToken = await getAccessToken(connection);
  const start = new Date(input.start);
  const end = new Date(input.end);

  if (connection.provider === 'google') {
    return requestJson('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.title,
        description: input.description || '',
        location: input.location || '',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });
  }

  return requestJson('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: input.title,
      body: {
        contentType: 'Text',
        content: input.description || '',
      },
      start: {
        dateTime: start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'UTC',
      },
      location: {
        displayName: input.location || '',
      },
    }),
  });
}

router.get('/providers', auth, async function (req, res) {
  try {
    const connections = await CalendarConnection.find({ user: req.user._id }).lean();
    const byProvider = connections.reduce(function (accumulator, connection) {
      accumulator[connection.provider] = connection;
      return accumulator;
    }, {});

    const providers = ['google', 'outlook'].map(function (provider) {
      const config = getProviderConfig(provider);
      const connection = byProvider[provider];
      return {
        provider,
        label: config?.label || provider,
        configured: isProviderConfigured(config),
        connected: Boolean(connection),
        email: connection?.email || '',
        expiresAt: connection?.expiresAt || null,
        lastSyncAt: connection?.lastSyncAt || null,
      };
    });

    res.json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/connect/:provider', auth, async function (req, res) {
  try {
    const provider = req.params.provider;
    const config = getProviderConfig(provider);

    if (!config || !isProviderConfigured(config)) {
      return res.status(400).json({ success: false, message: 'Calendar provider is not configured' });
    }

    const state = signState({
      provider,
      userId: String(req.user._id),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = new URL(config.authorizeUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scope);
    authUrl.searchParams.set('state', state);

    if (provider === 'google') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('include_granted_scopes', 'true');
    }

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/callback/:provider', async function (req, res) {
  const provider = req.params.provider;
  const frontendBaseUrl = getFrontendBaseUrl(req);
  const redirect = new URL('/calendar', frontendBaseUrl);
  redirect.searchParams.set('provider', provider);

  try {
    if (!req.query.code || !req.query.state) {
      throw new Error('Missing calendar authorization payload');
    }

    const state = verifyState(req.query.state);
    if (state.provider !== provider) {
      throw new Error('Calendar provider mismatch');
    }

    const tokenPayload = await exchangeCode(provider, req.query.code);
    const accessToken = tokenPayload.access_token;
    const refreshToken = tokenPayload.refresh_token || '';
    const profile = await fetchProfile(provider, accessToken);
    const email = profile?.email || profile?.userPrincipalName || '';

    await CalendarConnection.findOneAndUpdate(
      { user: state.userId, provider },
      {
        user: state.userId,
        provider,
        email,
        accessToken: encryptValue(accessToken),
        refreshToken: refreshToken ? encryptValue(refreshToken) : '',
        expiresAt: tokenPayload.expires_in ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000) : null,
        scope: tokenPayload.scope || '',
        metadata: {
          tokenType: tokenPayload.token_type || '',
        },
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    redirect.searchParams.set('status', 'connected');
  } catch (error) {
    redirect.searchParams.set('status', 'error');
    redirect.searchParams.set('message', error.message);
  }

  res.redirect(redirect.toString());
});

router.delete('/connect/:provider', auth, async function (req, res) {
  try {
    await CalendarConnection.findOneAndDelete({ user: req.user._id, provider: req.params.provider });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/events', auth, async function (req, res) {
  try {
    const rangeStart = req.query.start || new Date().toISOString();
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    const rangeEnd = req.query.end || defaultEnd.toISOString();
    const provider = req.query.provider;

    const filter = { user: req.user._id };
    if (provider) filter.provider = provider;

    const connections = await CalendarConnection.find(filter).select('+accessToken +refreshToken');
    const events = [];

    for (const connection of connections) {
      try {
        const providerEvents = await fetchRemoteEvents(connection, rangeStart, rangeEnd);
        events.push.apply(events, providerEvents);
        connection.lastSyncAt = new Date();
        await connection.save();
      } catch (providerError) {
        events.push({
          id: connection.provider + '-error',
          provider: connection.provider,
          title: connection.provider === 'google' ? 'Google Calendar unavailable' : 'Outlook unavailable',
          description: providerError.message,
          start: rangeStart,
          end: rangeStart,
          source: 'error',
          status: 'error',
        });
      }
    }

    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/events', auth, async function (req, res) {
  try {
    const { provider, title, start, end, description, location } = req.body;
    if (!provider || !title || !start || !end) {
      return res.status(400).json({ success: false, message: 'Provider, title, start, and end are required' });
    }

    const connection = await CalendarConnection.findOne({ user: req.user._id, provider }).select('+accessToken +refreshToken');
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Calendar provider is not connected' });
    }

    const event = await createRemoteEvent(connection, { title, start, end, description, location });
    connection.lastSyncAt = new Date();
    await connection.save();

    res.status(201).json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
