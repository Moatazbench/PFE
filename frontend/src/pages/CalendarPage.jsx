import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { ToastContainer, useToast } from '../components/common/Toast';
import { buildCalendarItems, getEventTone } from '../utils/workManagement';
import '../work-management.css';

var MAX_MONTH_EVENTS_VISIBLE = 3;

function startOfDay(value) {
  var date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, amount) {
  var date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function hexToRgba(hex, alpha) {
  var normalized = String(hex || '').replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map(function (char) {
      return char + char;
    }).join('');
  }

  if (normalized.length !== 6) {
    return 'rgba(100, 116, 139, ' + alpha + ')';
  }

  var red = parseInt(normalized.slice(0, 2), 16);
  var green = parseInt(normalized.slice(2, 4), 16);
  var blue = parseInt(normalized.slice(4, 6), 16);
  return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + alpha + ')';
}

function getRange(selectedDate, layout) {
  var start = startOfDay(selectedDate);
  if (layout === 'day') {
    return { start: start, end: addDays(start, 1) };
  }
  if (layout === 'week') {
    var weekStart = addDays(start, -start.getDay());
    return { start: weekStart, end: addDays(weekStart, 7) };
  }
  var monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  var gridStart = addDays(monthStart, -monthStart.getDay());
  return { start: gridStart, end: addDays(gridStart, 42) };
}

function buildMonthGrid(selectedDate) {
  var monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  var gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }).map(function (_, index) {
    return addDays(gridStart, index);
  });
}

function getCalendarDayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function toProviderEventPayload(item) {
  var start = new Date(item.start);
  var end = item.end ? new Date(item.end) : null;

  if (item.allDay || !end || Number.isNaN(end.getTime()) || end <= start) {
    start.setHours(9, 0, 0, 0);
    end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
  }

  return {
    title: item.title,
    description: item.description || '',
    start: start.toISOString(),
    end: end.toISOString(),
    location: item.meta || '',
  };
}

function getEventTypeLabel(item) {
  if (item.type === 'checkin') return 'Check-in';
  if (item.type === 'objective') return 'Objective';
  if (item.type === 'meeting') return 'Meeting';
  if (item.type === 'task') return 'Task';
  if (item.type === 'google') return 'Google';
  if (item.type === 'outlook') return 'Outlook';
  return String(item.type || 'Event').replace(/_/g, ' ');
}

function getEventTimeLabel(item) {
  if (item.allDay) return 'All day';

  var start = new Date(item.start);
  if (Number.isNaN(start.getTime())) return '';

  var startLabel = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  var end = item.end ? new Date(item.end) : null;
  if (!end || Number.isNaN(end.getTime()) || end <= start) {
    return startLabel;
  }

  var endLabel = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return startLabel + ' - ' + endLabel;
}

function getEventTooltip(item) {
  var details = [
    item.title,
    getEventTypeLabel(item),
    getEventTimeLabel(item),
    item.meta || '',
  ].filter(Boolean);

  return details.join(' • ');
}

function getEventStyle(item) {
  var accent = getEventTone(item.type);

  return {
    '--event-accent': accent,
    '--event-bg': hexToRgba(accent, item.type === 'meeting' ? 0.16 : 0.12),
    '--event-soft': hexToRgba(accent, 0.08),
    '--event-border': hexToRgba(accent, 0.24),
  };
}

function CalendarPage() {
  var toast = useToast();
  var location = useLocation();
  var navigate = useNavigate();

  var [layout, setLayout] = useState('month');
  var [selectedDate, setSelectedDate] = useState(new Date());
  var [loading, setLoading] = useState(true);
  var [taskItems, setTaskItems] = useState([]);
  var [objectiveItems, setObjectiveItems] = useState([]);
  var [meetingItems, setMeetingItems] = useState([]);
  var [checkInItems, setCheckInItems] = useState([]);
  var [providerEvents, setProviderEvents] = useState([]);
  var [providers, setProviders] = useState([]);
  var [syncingKey, setSyncingKey] = useState('');
  var [selectedEvent, setSelectedEvent] = useState(null);
  var [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  var popoverRef = useRef(null);

  useEffect(function () {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setSelectedEvent(null);
      }
    }
    if (selectedEvent) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return function () {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedEvent]);

  var range = useMemo(function () {
    return getRange(selectedDate, layout);
  }, [layout, selectedDate]);

  useEffect(function () {
    var params = new URLSearchParams(location.search);
    var status = params.get('status');
    var provider = params.get('provider');
    var message = params.get('message');

    if (!status) return;

    if (status === 'connected') {
      toast.success((provider || 'Calendar') + ' connected');
    } else if (status === 'error') {
      toast.error(message || 'Calendar connection failed');
    }

    navigate('/calendar', { replace: true });
  }, [location.search, navigate]);

  useEffect(function () {
    loadCalendarData();
  }, [layout, selectedDate]);

  function loadCalendarData() {
    setLoading(true);

    Promise.allSettled([
      api.get('/tasks/my'),
      api.get('/objectives/my'),
      api.get('/meetings', { params: { scope: 'self' } }),
      api.get('/checkins', { params: { scope: 'self' } }),
      api.get('/calendar/providers'),
      api.get('/calendar/events', {
        params: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      }),
    ]).then(function (results) {
      var objectivePayload = results[1].status === 'fulfilled' ? results[1].value.data : {};
      setTaskItems(results[0].status === 'fulfilled' ? (results[0].value.data.tasks || []) : []);
      setObjectiveItems(results[1].status === 'fulfilled'
        ? []
            .concat(objectivePayload.objectives || [])
            .concat(objectivePayload.individualObjectives || [])
            .concat(objectivePayload.teamObjectives || [])
        : []);
      setMeetingItems(results[2].status === 'fulfilled' ? (results[2].value.data.meetings || []) : []);
      setCheckInItems(results[3].status === 'fulfilled' ? (results[3].value.data.checkIns || results[3].value.data.checkins || results[3].value.data.items || []) : []);
      setProviders(results[4].status === 'fulfilled' ? (results[4].value.data.providers || []) : []);
      setProviderEvents(results[5].status === 'fulfilled' ? (results[5].value.data.events || []) : []);
    }).finally(function () {
      setLoading(false);
    });
  }

  function shiftRange(direction) {
    if (layout === 'day') setSelectedDate(addDays(selectedDate, direction));
    else if (layout === 'week') setSelectedDate(addDays(selectedDate, direction * 7));
    else setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1));
  }

  function connectProvider(provider) {
    api.get('/calendar/connect/' + provider)
      .then(function (response) {
        window.location.href = response.data.authUrl;
      })
      .catch(function (error) {
        toast.error(error.response?.data?.message || 'Unable to start calendar connection');
      });
  }

  function disconnectProvider(provider) {
    api.delete('/calendar/connect/' + provider)
      .then(function () {
        toast.success('Calendar disconnected');
        loadCalendarData();
      })
      .catch(function () {
        toast.error('Could not disconnect calendar');
      });
  }

  function syncItemToProvider(item, provider) {
    setSyncingKey(item.id + '-' + provider);
    api.post('/calendar/events', Object.assign({ provider: provider }, toProviderEventPayload(item)))
      .then(function () {
        toast.success('Event sent to ' + provider);
        loadCalendarData();
      })
      .catch(function (error) {
        toast.error(error.response?.data?.message || 'Could not sync event');
      })
      .finally(function () {
        setSyncingKey('');
      });
  }

  var allItems = useMemo(function () {
    return buildCalendarItems({
      tasks: taskItems,
      objectives: objectiveItems,
      meetings: meetingItems,
      checkIns: checkInItems,
      providerEvents: providerEvents,
    });
  }, [checkInItems, meetingItems, objectiveItems, providerEvents, taskItems]);

  var visibleItems = useMemo(function () {
    return allItems.filter(function (item) {
      var date = new Date(item.start);
      return date >= range.start && date < range.end;
    });
  }, [allItems, range.end, range.start]);

  var visibleItemsByDay = useMemo(function () {
    return visibleItems.reduce(function (collection, item) {
      var dayKey = getCalendarDayKey(item.start);
      if (!collection[dayKey]) {
        collection[dayKey] = [];
      }
      collection[dayKey].push(item);
      return collection;
    }, Object.create(null));
  }, [visibleItems]);

  var upcomingItems = useMemo(function () {
    var now = new Date();
    return allItems.filter(function (item) {
      return new Date(item.start) >= now;
    }).slice(0, 8);
  }, [allItems]);

  var reminderItems = useMemo(function () {
    var now = startOfDay(new Date());
    return allItems.filter(function (item) {
      if (!['task', 'objective'].includes(item.type)) return false;
      var date = startOfDay(item.start);
      var delta = Math.round((date - now) / (1000 * 60 * 60 * 24));
      return delta <= 3;
    }).slice(0, 6);
  }, [allItems]);

  var monthGrid = useMemo(function () {
    return buildMonthGrid(selectedDate);
  }, [selectedDate]);

  var weekColumns = useMemo(function () {
    if (layout === 'day') return [startOfDay(selectedDate)];
    return Array.from({ length: 7 }).map(function (_, index) {
      return addDays(range.start, index);
    });
  }, [layout, range.start, selectedDate]);

  var connectedProviders = providers.filter(function (provider) { return provider.connected; });
  var todayKey = getCalendarDayKey(new Date());

  return (
    <div className="page-container page-container--wide wm-page wm-page--calendar" style={{ position: 'relative' }}>
      <div className="page-header wm-page__header">
        <div className="page-header__left">
          <h1 className="page-title">Calendar Workspace</h1>
          <p className="page-subtitle">Plan work across tasks, goals, check-ins, meetings, and external calendars.</p>
        </div>
        <div className="wm-page__actions">
          <div className="wm-segmented">
            <button type="button" className={layout === 'month' ? 'is-active' : ''} onClick={function () { setLayout('month'); }}>Month</button>
            <button type="button" className={layout === 'week' ? 'is-active' : ''} onClick={function () { setLayout('week'); }}>Week</button>
            <button type="button" className={layout === 'day' ? 'is-active' : ''} onClick={function () { setLayout('day'); }}>Day</button>
          </div>
        </div>
      </div>

      <div className="wm-calendar-shell wm-calendar-shell--calendar">
        <section className="wm-calendar-main">
          <div className="wm-panel-card">
            <div className="wm-calendar-toolbar">
              <div className="wm-calendar-toolbar__controls">
                <button type="button" className="btn btn--secondary btn--sm" onClick={function () { shiftRange(-1); }}>Previous</button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={function () { setSelectedDate(new Date()); }}>Today</button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={function () { shiftRange(1); }}>Next</button>
              </div>
              <strong className="wm-calendar-toolbar__title">
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: layout === 'day' ? 'numeric' : undefined })}
              </strong>
            </div>

            {loading ? (
              <LoadingSkeleton rows={4} height={92} />
            ) : layout === 'month' ? (
              <>
                <div className="wm-calendar-grid__weekdays" aria-hidden="true">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (label) {
                    return <div key={label}>{label}</div>;
                  })}
                </div>
                <div className="wm-calendar-grid">
                {monthGrid.map(function (day) {
                  var dayKey = getCalendarDayKey(day);
                  var dayItems = visibleItemsByDay[dayKey] || [];
                  var visibleDayItems = dayItems.slice(0, MAX_MONTH_EVENTS_VISIBLE);
                  var isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                  var isToday = dayKey === todayKey;
                  var cellClassName = 'wm-calendar-grid__cell'
                    + (isCurrentMonth ? '' : ' is-muted')
                    + (isToday ? ' is-today' : '');
                  return (
                    <div key={dayKey} className={cellClassName}>
                      <div className="wm-calendar-grid__day">{day.getDate()}</div>
                      <div className="wm-calendar-grid__events">
                        {visibleDayItems.map(function (item) {
                          return (
                            <div key={item.id} className="wm-calendar-event wm-calendar-event--month" style={getEventStyle(item)} title={getEventTooltip(item)}
                              onClick={function (e) {
                                var rect = e.currentTarget.getBoundingClientRect();
                                setPopoverPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 300) });
                                setSelectedEvent(item);
                              }}
                            >
                              <div className="wm-calendar-event__top">
                                <span className="wm-calendar-event__type">{getEventTypeLabel(item)}</span>
                                <span className="wm-calendar-event__time">{getEventTimeLabel(item)}</span>
                              </div>
                              <strong className="wm-calendar-event__title">{item.title}</strong>
                              {item.meta ? <span className="wm-calendar-event__meta">{item.meta}</span> : null}
                            </div>
                          );
                        })}
                        {dayItems.length > MAX_MONTH_EVENTS_VISIBLE ? <small className="wm-calendar-grid__more">+{dayItems.length - MAX_MONTH_EVENTS_VISIBLE} more</small> : null}
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
            ) : (
              <div className={'wm-agenda-grid' + (layout === 'week' ? ' is-week' : ' is-day')}>
                {weekColumns.map(function (day) {
                  var dayKey = getCalendarDayKey(day);
                  var dayItems = visibleItemsByDay[dayKey] || [];
                  return (
                    <div key={dayKey} className="wm-agenda-column">
                      <header>
                        <strong>{day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                        <span>{dayItems.length} items</span>
                      </header>
                      {dayItems.length === 0 ? (
                        <div className="wm-empty-inline">No events</div>
                      ) : (
                        dayItems.map(function (item) {
                          return (
                            <div key={item.id} className="wm-agenda-item" style={getEventStyle(item)} title={getEventTooltip(item)}
                              onClick={function (e) {
                                var rect = e.currentTarget.getBoundingClientRect();
                                setPopoverPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 300) });
                                setSelectedEvent(item);
                              }}
                            >
                              <div className="wm-calendar-event__top">
                                <span className="wm-calendar-event__type">{getEventTypeLabel(item)}</span>
                                <span className="wm-calendar-event__time">{getEventTimeLabel(item)}</span>
                              </div>
                              <strong className="wm-calendar-event__title">{item.title}</strong>
                              <span className="wm-calendar-event__meta">{item.meta || getEventTypeLabel(item)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wm-panel-card">
            <div className="wm-panel-card__header">
              <div>
                <h3>Provider sync</h3>
                <p>Secure OAuth connections for Google Calendar and Outlook.</p>
              </div>
            </div>
            <div className="wm-provider-grid">
              {providers.map(function (provider) {
                return (
                  <div key={provider.provider} className="wm-provider-card">
                    <div>
                      <strong>{provider.label}</strong>
                      <p>{provider.connected ? (provider.email || 'Connected') : (provider.configured ? 'Ready to connect' : 'Credentials not configured')}</p>
                    </div>
                    {provider.connected ? (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={function () { disconnectProvider(provider.provider); }}>Disconnect</button>
                    ) : (
                      <button type="button" className="btn btn--primary btn--sm" disabled={!provider.configured} onClick={function () { connectProvider(provider.provider); }}>Connect</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="wm-side-panel">
          <div className="wm-panel-card">
            <div className="wm-panel-card__header">
              <div>
                <h3>Upcoming events</h3>
                <p>Internal and synced provider items.</p>
              </div>
            </div>
            <div className="wm-timesheet-list">
              {upcomingItems.length === 0 ? (
                <div className="wm-empty-inline">No upcoming events</div>
              ) : (
                upcomingItems.map(function (item) {
                  return (
                    <div key={item.id} className="wm-timesheet-row">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{new Date(item.start).toLocaleString()}</span>
                      </div>
                      <div className="wm-timesheet-row__meta">
                        <span className="wm-stage-pill" style={{ color: getEventTone(item.type) }}>{item.type}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="wm-panel-card">
            <div className="wm-panel-card__header">
              <div>
                <h3>Deadline reminders</h3>
                <p>Tasks and goals due soon.</p>
              </div>
            </div>
            {reminderItems.length === 0 ? (
              <div className="wm-empty-inline">No reminders due soon</div>
            ) : (
              <div className="wm-timesheet-list">
                {reminderItems.map(function (item) {
                  return (
                    <div key={item.id} className="wm-timesheet-row">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{new Date(item.start).toLocaleDateString()}</span>
                      </div>
                      <div className="wm-timesheet-row__meta">
                        <span className="wm-stage-pill">{item.type}</span>
                        {connectedProviders.map(function (provider) {
                          var syncKey = item.id + '-' + provider.provider;
                          return (
                            <button
                              key={provider.provider}
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={syncingKey === syncKey}
                              onClick={function () { syncItemToProvider(item, provider.provider); }}
                            >
                              {syncingKey === syncKey ? 'Syncing...' : 'Sync ' + provider.label.split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {selectedEvent ? (
        <div
          ref={popoverRef}
          className="wm-event-popover"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 2000,
            minWidth: 240,
            maxWidth: 320,
            background: '#fff',
            border: '1px solid rgba(148, 163, 184, 0.28)',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
            padding: '1rem 1.1rem',
            animation: 'ent-slideUp 0.16s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: getEventTone(selectedEvent.type),
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '0.28rem 0.55rem',
                borderRadius: 999,
              }}
            >
              {getEventTypeLabel(selectedEvent)}
            </span>
            <button
              type="button"
              onClick={function () { setSelectedEvent(null); }}
              style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 0 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.35rem' }}>
            {selectedEvent.title}
          </strong>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.2rem' }}>
            {new Date(selectedEvent.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.55rem' }}>
            {getEventTimeLabel(selectedEvent)}
          </div>
          {selectedEvent.meta ? (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.55rem' }}>{selectedEvent.meta}</div>
          ) : null}
          {selectedEvent.type === 'meeting' ? (
            <a
              href="/meetings"
              style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4338ca', textDecoration: 'none' }}
              onClick={function () { setSelectedEvent(null); }}
            >
              View full →
            </a>
          ) : selectedEvent.type === 'task' ? (
            <a
              href="/tasks"
              style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4338ca', textDecoration: 'none' }}
              onClick={function () { setSelectedEvent(null); }}
            >
              View full →
            </a>
          ) : selectedEvent.type === 'objective' ? (
            <a
              href="/goals"
              style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4338ca', textDecoration: 'none' }}
              onClick={function () { setSelectedEvent(null); }}
            >
              View full →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default CalendarPage;
