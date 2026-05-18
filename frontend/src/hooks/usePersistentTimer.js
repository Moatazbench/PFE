import { useEffect, useMemo, useState } from 'react';

var STORAGE_KEY = 'perfmanager.productivityTimer';

function readStoredTimer() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeStoredTimer(value) {
  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function resolveElapsedSeconds(timer) {
  if (!timer) return 0;
  var baseElapsed = Number(timer.elapsedSeconds || 0);
  if (!timer.isRunning || !timer.startedAt) return baseElapsed;
  return baseElapsed + Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000));
}

export default function usePersistentTimer() {
  var [timerState, setTimerState] = useState(function () {
    return readStoredTimer();
  });
  var [tick, setTick] = useState(0);

  useEffect(function () {
    writeStoredTimer(timerState);
  }, [timerState]);

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
      if (event.key !== STORAGE_KEY) return;
      setTimerState(readStoredTimer());
    }

    window.addEventListener('storage', handleStorage);
    return function () {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  var elapsedSeconds = useMemo(function () {
    tick;
    return resolveElapsedSeconds(timerState);
  }, [tick, timerState]);

  function startTimer(payload) {
    setTimerState({
      taskId: payload.taskId,
      taskTitle: payload.taskTitle || 'Task',
      linkedGoal: payload.linkedGoal || '',
      taskSnapshot: payload.taskSnapshot || null,
      focusMode: Boolean(payload.focusMode),
      isRunning: true,
      startedAt: new Date().toISOString(),
      elapsedSeconds: 0,
    });
  }

  function pauseTimer() {
    setTimerState(function (current) {
      if (!current?.isRunning) return current;
      return Object.assign({}, current, {
        isRunning: false,
        startedAt: null,
        elapsedSeconds: resolveElapsedSeconds(current),
      });
    });
  }

  function resumeTimer() {
    setTimerState(function (current) {
      if (!current || current.isRunning) return current;
      return Object.assign({}, current, {
        isRunning: true,
        startedAt: new Date().toISOString(),
      });
    });
  }

  function stopTimer() {
    var current = readStoredTimer();
    var durationSeconds = resolveElapsedSeconds(current);
    writeStoredTimer(null);
    setTimerState(null);

    if (!current || !current.taskId || durationSeconds <= 0) return null;

    return {
      taskId: current.taskId,
      taskTitle: current.taskTitle,
      linkedGoal: current.linkedGoal,
      taskSnapshot: current.taskSnapshot || null,
      focusMode: Boolean(current.focusMode),
      durationSeconds,
      startedAt: current.startedAt ? new Date(Date.now() - durationSeconds * 1000).toISOString() : new Date().toISOString(),
      endedAt: new Date().toISOString(),
      source: 'timer',
    };
  }

  function clearTimer() {
    writeStoredTimer(null);
    setTimerState(null);
  }

  return {
    timerState,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    clearTimer,
  };
}
