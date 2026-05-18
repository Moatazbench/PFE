import React from 'react';
import { motion } from 'framer-motion';
import { formatDurationLong } from '../../utils/workManagement';

function ProductivityTimerWidget({ timerState, elapsedSeconds, onPause, onResume, onStop }) {
  if (!timerState?.taskId) return null;

  return (
    <motion.aside
      className="wm-timer-widget"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <div className="wm-timer-widget__eyebrow">{timerState.focusMode ? 'Focus session' : 'Active timer'}</div>
      <strong>{timerState.taskTitle}</strong>
      {timerState.linkedGoal ? <p>{timerState.linkedGoal}</p> : null}
      <div className="wm-timer-widget__clock">{formatDurationLong(elapsedSeconds)}</div>
      <div className="wm-timer-widget__actions">
        {timerState.isRunning ? (
          <button type="button" className="btn btn--secondary" onClick={onPause}>Pause</button>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={onResume}>Resume</button>
        )}
        <button type="button" className="btn btn--primary" onClick={onStop}>Stop</button>
      </div>
    </motion.aside>
  );
}

export default React.memo(ProductivityTimerWidget);
