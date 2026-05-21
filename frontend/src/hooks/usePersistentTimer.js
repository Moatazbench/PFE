import { useEffect, useMemo, useState } from 'react';

var LEGACY_STORAGE_KEY = 'perfmanager.productivityTimer';
var STORAGE_KEY_PREFIX = 'perfmanager.productivityTimer';

function buildStorageKey(userId) {
  var normalizedUserId = String(userId || '').trim();
  return normalizedUserId ? STORAGE_KEY_PREFIX + '.' + normalizedUserId : '';
}

function normalizeIsoDate(value) {
  if (!value) return null;
  var parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeStoredTimer(timer, userId) {
  if (!timer || typeof timer !== 'object') return null;

  var ownerId = String(timer.ownerId || '');
  if (!ownerId || (userId && ownerId !== String(userId))) return null;

  var taskId = String(timer.taskId || '');
  if (!taskId) return null;

  var startedAt = normalizeIsoDate(timer.startedAt);
  var sessionStartedAt = normalizeIsoDate(timer.sessionStartedAt) || startedAt;
  var isRunning = Boolean(timer.isRunning && startedAt);

  return {
    ownerId: ownerId,
    taskId: taskId,
    taskTitle: timer.taskTitle || 'Task',
    linkedGoal: timer.linkedGoal || '',
    taskSnapshot: timer.taskSnapshot || null,
    focusMode: Boolean(timer.focusMode),
    isRunning: isRunning,
    startedAt: isRunning ? startedAt : null,
    sessionStartedAt: sessionStartedAt,
    elapsedSeconds: Math.max(0, Math.round(Number(timer.elapsedSeconds || 0))),
  };
}

function readStoredTimer(storageKey, userId) {
  if (!storageKey) return null;
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return normalizeStoredTimer(JSON.parse(raw), userId);
  } catch {
    return null;
  }
}

function writeStoredTimer(storageKey, value) {
  if (!storageKey) return;
  if (!value) {
    localStorage.removeItem(storageKey);
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(value));
}

function resolveElapsedSeconds(timer) {
  if (!timer) return 0;
  var baseElapsed = Number(timer.elapsedSeconds || 0);
  if (!timer.isRunning || !timer.startedAt) return baseElapsed;
  return baseElapsed + Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000));
}

function buildSessionFromTimer(current, endedAtOverride) {
  if (!current || !current.taskId) return null;

  var endedAt = normalizeIsoDate(endedAtOverride) || new Date().toISOString();
  var durationSeconds = resolveElapsedSeconds(current);
  if (durationSeconds <= 0) return null;

  var startedAt = current.sessionStartedAt
    || current.startedAt
    || new Date(new Date(endedAt).getTime() - durationSeconds * 1000).toISOString();

  return {
    taskId: current.taskId,
    taskTitle: current.taskTitle,
    linkedGoal: current.linkedGoal,
    taskSnapshot: current.taskSnapshot || null,
    focusMode: Boolean(current.focusMode),
    durationSeconds: durationSeconds,
    startedAt: startedAt,
    endedAt: endedAt,
    source: 'timer',
  };
}

export default function usePersistentTimer(userId) {
  var resolvedUserId = String(userId || '');
  var storageKey = buildStorageKey(resolvedUserId);
  var [timerStore, setTimerStore] = useState(function () {
    return {
      storageKey: storageKey,
      value: readStoredTimer(storageKey, resolvedUserId),
    };
  });
  var [tick, setTick] = useState(0);

  useEffect(function () {
    if (!storageKey) {
      setTimerStore({ storageKey: '', value: null });
      setTick(0);
      return;
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setTimerStore({
      storageKey: storageKey,
      value: readStoredTimer(storageKey, resolvedUserId),
    });
    setTick(0);
  }, [resolvedUserId, storageKey]);

  useEffect(function () {
    if (!storageKey || timerStore.storageKey !== storageKey) return;
    writeStoredTimer(storageKey, timerStore.value);
  }, [storageKey, timerStore]);

  var timerState = timerStore.storageKey === storageKey
    ? timerStore.value
    : readStoredTimer(storageKey, resolvedUserId);

  useEffect(function () {
    if (!timerState?.isRunning) return undefined;
    var interval = window.setInterval(function () {
      setTick(function (value) { return value + 1; });
    }, 1000);
    return function () {
      window.clearInterval(interval);
    };
  }, [timerState?.isRunning]);

  useEffect(function () {
    function handleStorage(event) {
      if (event.key !== storageKey) return;
      setTimerStore({
        storageKey: storageKey,
        value: readStoredTimer(storageKey, resolvedUserId),
      });
    }

    window.addEventListener('storage', handleStorage);
    return function () {
      window.removeEventListener('storage', handleStorage);
    };
  }, [resolvedUserId, storageKey]);

  var elapsedSeconds = useMemo(function () {
    tick;
    return resolveElapsedSeconds(timerState);
  }, [tick, timerState]);

  function readCurrentTimer() {
    if (!storageKey) return null;
    if (timerStore.storageKey === storageKey) return timerStore.value;
    return readStoredTimer(storageKey, resolvedUserId);
  }

  function updateTimerStore(nextTimerOrUpdater) {
    setTimerStore(function (currentStore) {
      var currentTimer = currentStore.storageKey === storageKey
        ? currentStore.value
        : readStoredTimer(storageKey, resolvedUserId);
      var nextTimer = typeof nextTimerOrUpdater === 'function'
        ? nextTimerOrUpdater(currentTimer)
        : nextTimerOrUpdater;

      return {
        storageKey: storageKey,
        value: nextTimer,
      };
    });
  }

  function startTimer(payload) {
    if (!storageKey || !resolvedUserId) {
      return { ok: false, reason: 'missing_user', timer: null };
    }

    var current = readCurrentTimer();
    if (current?.taskId) {
      if (current.taskId === payload.taskId) {
        return { ok: false, reason: 'already_tracking', timer: current };
      }
      return { ok: false, reason: 'another_timer_active', timer: current };
    }

    var startedAt = new Date().toISOString();
    var nextState = {
      ownerId: resolvedUserId,
      taskId: payload.taskId,
      taskTitle: payload.taskTitle || 'Task',
      linkedGoal: payload.linkedGoal || '',
      taskSnapshot: payload.taskSnapshot || null,
      focusMode: Boolean(payload.focusMode),
      isRunning: true,
      startedAt: startedAt,
      sessionStartedAt: startedAt,
      elapsedSeconds: 0,
    };

    updateTimerStore(nextState);
    return { ok: true, timer: nextState };
  }

  function pauseTimer() {
    updateTimerStore(function (current) {
      if (!current?.isRunning) return current;
      return Object.assign({}, current, {
        isRunning: false,
        startedAt: null,
        sessionStartedAt: current.sessionStartedAt || current.startedAt || null,
        elapsedSeconds: resolveElapsedSeconds(current),
      });
    });
  }

  function resumeTimer() {
    updateTimerStore(function (current) {
      if (!current || current.isRunning) return current;
      return Object.assign({}, current, {
        isRunning: true,
        startedAt: new Date().toISOString(),
      });
    });
  }

  function stopTimer() {
    var current = readCurrentTimer();
    writeStoredTimer(storageKey, null);
    updateTimerStore(null);
    return buildSessionFromTimer(current);
  }

  function consumeTimer(options) {
    var settings = options || {};
    var current = readCurrentTimer();
    var session = buildSessionFromTimer(current, settings.endedAt);
    writeStoredTimer(storageKey, null);
    if (!settings.skipState) {
      updateTimerStore(null);
    }
    return session;
  }

  function clearTimer() {
    writeStoredTimer(storageKey, null);
    updateTimerStore(null);
  }

  return {
    timerState,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    consumeTimer,
    clearTimer,
  };
}
