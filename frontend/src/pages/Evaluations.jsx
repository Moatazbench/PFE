import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';
import CreateGoalModal from '../components/goals/CreateGoalModal';
import EditGoalModal from '../components/goals/EditGoalModal';
import api from '../services/api';

function Evaluations() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [selectedObjective, setSelectedObjective] = useState(null);

  const [cycleForm, setCycleForm] = useState({
    name: '',
    year: new Date().getFullYear(),
    type: 'Mid-Year',
    evaluationStart: '',
    evaluationEnd: ''
  });

  const [objectiveForm, setObjectiveForm] = useState({
    title: '',
    description: '',
    category: 'individual',
    weight: 15,
    deadline: '',
    cycle: '',
    successIndicator: ''
  });

  const [submitForm, setSubmitForm] = useState({
    achievementPercent: 0,
    selfAssessment: ''
  });

  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  async function fetchData() {
    try {
      var cyclesRes = await api.get('/api/cycles');
      var objectivesRes = await api.get('/api/objectives/my');
      setCycles(cyclesRes.data);
      setObjectives(objectivesRes.data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    fetchData();
  }, []);

  useEffect(function () {
    if (success) {
      var timer = setTimeout(function () {
        setSuccess('');
      }, 3000);
      return function () { clearTimeout(timer); };
    }
  }, [success]);

  function getDaysInMonth(date) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var daysInMonth = lastDay.getDate();
    var startingDay = firstDay.getDay();

    var days = [];

    var prevMonth = new Date(year, month, 0);
    var prevMonthDays = prevMonth.getDate();
    for (var i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }

    for (var d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true
      });
    }

    var remaining = 42 - days.length;
    for (var n = 1; n <= remaining; n++) {
      days.push({
        date: new Date(year, month + 1, n),
        isCurrentMonth: false
      });
    }

    return days;
  }

  function formatMonthYear(date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function formatDateInput(date) {
    if (!date) return '';
    var d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  function formatDateDisplay(dateStr) {
    return new Date(dateStr).toLocaleDateString();
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function isToday(date) {
    var today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  function getEventsForDate(date) {
    var events = [];
    var d = new Date(date);
    d.setHours(12, 0, 0, 0);

    cycles.forEach(function (cycle) {
      var evalStart = new Date(cycle.evaluationStart);
      var evalEnd = new Date(cycle.evaluationEnd);
      evalStart.setHours(0, 0, 0, 0);
      evalEnd.setHours(23, 59, 59, 999);

      if (d >= evalStart && d <= evalEnd) {
        events.push({
          type: 'cycle-evaluation',
          data: cycle,
          color: '#3498db',
          label: cycle.name + ' (Eval)',
          isStart: isSameDay(d, evalStart),
          isEnd: isSameDay(d, evalEnd)
        });
      }
    });

    objectives.forEach(function (obj) {
      if (obj.deadline) {
        var deadline = new Date(obj.deadline);
        deadline.setHours(12, 0, 0, 0);
        if (isSameDay(d, deadline)) {
          events.push({
            type: 'objective-deadline',
            data: obj,
            color: getStatusColor(obj.status),
            label: obj.title
          });
        }
      }
    });

    return events;
  }

  function getStatusColor(status) {
    var colors = {
      draft: '#95a5a6',
      active: '#9b59b6',
      submitted: '#f39c12',
      validated: '#27ae60',
      rejected: '#e74c3c'
    };
    return colors[status] || '#666';
  }

  function handleDateClick(date) {
    setSelectedDate(date);
    setShowCreateModal(true);
    setError('');

    var dateStr = formatDateInput(date);
    setObjectiveForm(function (prev) {
      return { ...prev, deadline: dateStr };
    });
  }

  function handleEventClick(event, e) {
    e.stopPropagation();
    setError('');

    if (event.type === 'cycle-evaluation') {
      setSelectedCycle(event.data);
      setShowEventModal(true);
    } else if (event.type === 'objective-deadline') {
      setSelectedObjective(event.data);
      setObjectiveForm({
        title: event.data.title,
        description: event.data.description || '',
        category: event.data.category || 'individual',
        weight: event.data.weight,
        deadline: formatDateInput(event.data.deadline),
        cycle: event.data.cycle?._id || '',
        successIndicator: event.data.successIndicator || ''
      });
      setShowObjectiveModal(true);
    }
  }

  function validateCycleDates() {
    if (!cycleForm.evaluationStart || !cycleForm.evaluationEnd) {
      return 'All dates are required';
    }

    var evalStart = new Date(cycleForm.evaluationStart);
    var evalEnd = new Date(cycleForm.evaluationEnd);

    evalStart.setHours(0, 0, 0, 0);
    evalEnd.setHours(0, 0, 0, 0);

    if (evalEnd < evalStart) {
      return 'Evaluation end date cannot be before start date';
    }

    return null;
  }

  function openCreateCycle() {
    setSelectedCycle(null);
    setCycleForm({
      name: '',
      year: new Date().getFullYear(),
      type: 'Mid-Year',
      evaluationStart: formatDateInput(selectedDate),
      evaluationEnd: ''
    });
    setDateError('');
    setShowCreateModal(false);
    setShowCycleModal(true);
  }

  function openEditCycle(cycle) {
    setSelectedCycle(cycle);
    setCycleForm({
      name: cycle.name,
      year: cycle.year,
      type: cycle.type,
      evaluationStart: formatDateInput(cycle.evaluationStart),
      evaluationEnd: formatDateInput(cycle.evaluationEnd)
    });
    setDateError('');
    setShowEventModal(false);
    setShowCycleModal(true);
  }

  async function handleSaveCycle(e) {
    e.preventDefault();
    setError('');
    setDateError('');

    // Admin bypasses all client-side date validation
    if (user.role !== 'ADMIN') {
      var dateValidation = validateCycleDates();
      if (dateValidation) {
        setDateError(dateValidation);
        return;
      }
    }

    try {
      if (selectedCycle) {
        await api.put('/api/cycles/' + selectedCycle._id, cycleForm);
        setSuccess('Cycle updated successfully!');
      } else {
        await api.post('/api/cycles', cycleForm);
        setSuccess('Cycle created successfully!');
      }
      setShowCycleModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cycle');
    }
  }

  async function handleDeleteCycle(cycleId) {
    try {
      await api.delete('/api/cycles/' + cycleId);
      setSuccess('Cycle deleted!');
      setShowEventModal(false);
      setShowCycleModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete cycle');
    }
  }

  function openCreateObjective() {
    setSelectedObjective(null);
    setObjectiveForm({
      title: '',
      description: '',
      category: 'individual',
      weight: 15,
      deadline: formatDateInput(selectedDate),
      cycle: '',
      successIndicator: ''
    });
    setShowCreateModal(false);
    setShowObjectiveModal(true);
  }

  async function handleSaveObjective(e) {
    e.preventDefault();
    setError('');

    try {
      var data = {
        title: objectiveForm.title,
        description: objectiveForm.description,
        category: objectiveForm.category,
        successIndicator: objectiveForm.successIndicator,
        weight: parseInt(objectiveForm.weight),
        deadline: objectiveForm.deadline || null,
        cycle: objectiveForm.cycle || null,
        user: user._id
      };

      if (selectedObjective) {
        await api.put('/api/objectives/' + selectedObjective._id, data);
        setSuccess('Objective updated!');
      } else {
        await api.post('/api/objectives', data);
        setSuccess('Objective created!');
      }
      setShowObjectiveModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save objective');
    }
  }

  async function handleDeleteObjective(objId) {
    try {
      await api.delete('/api/objectives/' + objId);
      setSuccess('Objective deleted!');
      setShowObjectiveModal(false);
      setShowEventModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete objective');
    }
  }

  function openSubmitModal(obj) {
    setSelectedObjective(obj);
    setSubmitForm({
      achievementPercent: obj.achievementPercent || 0,
      selfAssessment: obj.selfAssessment || ''
    });
    setShowEventModal(false);
    setShowSubmitModal(true);
  }

  async function handleSubmitObjective(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/api/objectives/' + selectedObjective._id + '/submit', {
        achievementPercent: parseInt(submitForm.achievementPercent),
        selfAssessment: submitForm.selfAssessment
      });
      setSuccess('Objective submitted for review!');
      setShowSubmitModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit');
    }
  }

  function getObjectivesForCycle(cycleId) {
    return objectives.filter(function (obj) {
      return obj.cycle && obj.cycle._id === cycleId;
    });
  }

  function canSubmitObjective(obj) {
    return obj.status === 'draft' || obj.status === 'active' || obj.status === 'rejected';
  }

  function canEditObjective(obj) {
    return obj.status === 'draft' || obj.status === 'active' || obj.status === 'rejected';
  }

  function isInEvaluationPeriod(cycle) {
    if (!cycle) return false;
    var now = new Date();
    return now >= new Date(cycle.evaluationStart) && now <= new Date(cycle.evaluationEnd);
  }

  var days = getDaysInMonth(currentDate);
  var weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var rejectedCount = objectives.filter(function (o) { return o.status === 'rejected'; }).length;

  if (loading) {
    return <div className="loading">Loading calendar...</div>;
  }

  return (
    <div className="calendar-page">
      <div className="calendar-sidebar">
        <button onClick={function () { setSelectedDate(new Date()); setShowCreateModal(true); }} className="create-btn-large">
          + Create
        </button>

        <div className="mini-calendar">
          <div className="mini-header">
            <button onClick={prevMonth}>‹</button>
            <span>{formatMonthYear(currentDate)}</span>
            <button onClick={nextMonth}>›</button>
          </div>
        </div>

        <div className="sidebar-section">
          <h4>Active Cycles</h4>
          {cycles.filter(function (c) { return c.status === 'active'; }).length === 0 ? (
            <p className="no-data-small">No active cycles</p>
          ) : (
            <div className="sidebar-list">
              {cycles.filter(function (c) { return c.status === 'active'; }).map(function (cycle) {
                return (
                  <div key={cycle._id} className="sidebar-item" onClick={function () { setSelectedCycle(cycle); setShowEventModal(true); }}>
                    <span className="sidebar-color" style={{ backgroundColor: '#3498db' }}></span>
                    <span className="sidebar-label">{cycle.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <h4>My Objectives</h4>
          <div className="sidebar-stats">
            <div className="stat-row">
              <span>Draft:</span>
              <span>{objectives.filter(function (o) { return o.status === 'draft'; }).length}</span>
            </div>
            <div className="stat-row">
              <span>Submitted:</span>
              <span>{objectives.filter(function (o) { return o.status === 'submitted'; }).length}</span>
            </div>
            <div className="stat-row">
              <span>Validated:</span>
              <span>{objectives.filter(function (o) { return o.status === 'validated'; }).length}</span>
            </div>
            {rejectedCount > 0 && (
              <div className="stat-row rejected-stat">
                <span>Rejected:</span>
                <span>{rejectedCount}</span>
              </div>
            )}
          </div>
          {rejectedCount > 0 && (
            <div className="rejected-alert">
              You have {rejectedCount} rejected objective(s) that need revision
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <h4>Legend</h4>
          <div className="legend-list">
            <div className="legend-row">
              <span className="legend-color" style={{ backgroundColor: '#3498db' }}></span>
              <span>Evaluation Period</span>
            </div>
            <div className="legend-row">
              <span className="legend-color" style={{ backgroundColor: '#9b59b6' }}></span>
              <span>Objective Deadline</span>
            </div>
            <div className="legend-row">
              <span className="legend-color" style={{ backgroundColor: '#e74c3c' }}></span>
              <span>Rejected</span>
            </div>
          </div>
        </div>
      </div>

      <div className="calendar-main">
        <div className="calendar-toolbar">
          <div className="toolbar-left">
            <button onClick={goToToday} className="today-btn">Today</button>
            <button onClick={prevMonth} className="nav-arrow">‹</button>
            <button onClick={nextMonth} className="nav-arrow">›</button>
            <h2>{formatMonthYear(currentDate)}</h2>
          </div>
        </div>

        {success && (
          <div className="success-toast">
            {success}
            <button onClick={function () { setSuccess(''); }}>×</button>
          </div>
        )}

        <div className="calendar-grid-container">
          <div className="calendar-weekdays">
            {weekDays.map(function (day) {
              return <div key={day} className="weekday">{day}</div>;
            })}
          </div>

          <div className="calendar-days">
            {days.map(function (dayObj, index) {
              var events = getEventsForDate(dayObj.date);
              var isCurrentMonth = dayObj.isCurrentMonth;
              var today = isToday(dayObj.date);

              return (
                <div
                  key={index}
                  className={'calendar-day' + (isCurrentMonth ? '' : ' other-month') + (today ? ' today' : '')}
                  onClick={function () { handleDateClick(dayObj.date); }}
                >
                  <div className="day-header">
                    <span className={'day-number' + (today ? ' today-number' : '')}>
                      {dayObj.date.getDate()}
                    </span>
                  </div>
                  <div className="day-events">
                    {events.slice(0, 3).map(function (event, i) {
                      var eventClass = 'day-event';
                      if (event.isStart) eventClass += ' event-start';
                      if (event.isEnd) eventClass += ' event-end';
                      if (event.type.includes('cycle')) eventClass += ' event-bar';

                      return (
                        <div
                          key={i}
                          className={eventClass}
                          style={{ backgroundColor: event.color }}
                          onClick={function (e) { handleEventClick(event, e); }}
                          title={event.label}
                        >
                          <span className="event-label">{event.label}</span>
                        </div>
                      );
                    })}
                    {events.length > 3 && (
                      <div className="more-events">+{events.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={function () { setShowCreateModal(false); }}>
          <div className="modal modal-small" onClick={function (e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>Create New</h3>
              <button onClick={function () { setShowCreateModal(false); }} className="close-btn">×</button>
            </div>
            <p className="selected-date">{selectedDate?.toLocaleDateString()}</p>
            <div className="create-options">
              <button onClick={openCreateObjective} className="create-option">
                <span className="option-icon">🎯</span>
                <span className="option-text">
                  <strong>Objective</strong>
                  <small>Add a new objective with deadline</small>
                </span>
              </button>
              {(user.role === 'ADMIN' || user.role === 'HR') && (
                <button onClick={openCreateCycle} className="create-option">
                  <span className="option-icon">📅</span>
                  <span className="option-text">
                    <strong>Evaluation Cycle</strong>
                    <small>Create a new evaluation period</small>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showEventModal && selectedCycle && (
        <div className="modal-overlay" onClick={function () { setShowEventModal(false); }}>
          <div className="modal modal-medium" onClick={function (e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>{selectedCycle.name}</h3>
              <button onClick={function () { setShowEventModal(false); }} className="close-btn">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="event-details">
              <div className="detail-group">
                <span className="detail-label">Year:</span>
                <span>{selectedCycle.year}</span>
              </div>
              <div className="detail-group">
                <span className="detail-label">Type:</span>
                <span className="type-badge">{selectedCycle.type}</span>
              </div>
              <div className="detail-group">
                <span className="detail-label">Status:</span>
                <span className={'status-badge status-' + selectedCycle.status}>{selectedCycle.status}</span>
              </div>
              <div className="detail-group">
                <span className="detail-label">Evaluation Period:</span>
                <span>{formatDateDisplay(selectedCycle.evaluationStart)} - {formatDateDisplay(selectedCycle.evaluationEnd)}</span>
              </div>
              {isInEvaluationPeriod(selectedCycle) && (
                <div className="period-active-badge">
                  Evaluation Period is OPEN
                </div>
              )}
            </div>

            <div className="cycle-objectives">
              <h4>My Objectives ({getObjectivesForCycle(selectedCycle._id).length})</h4>
              {getObjectivesForCycle(selectedCycle._id).length === 0 ? (
                <p className="no-data-small">No objectives for this cycle</p>
              ) : (
                <div className="objectives-mini-list">
                  {getObjectivesForCycle(selectedCycle._id).map(function (obj) {
                    var isRejected = obj.status === 'rejected';
                    return (
                      <div key={obj._id} className={'objective-mini-item' + (isRejected ? ' rejected-item' : '')}>
                        <div className="obj-mini-info">
                          <span className="obj-mini-title">{obj.title}</span>
                          <span className="obj-mini-weight">Weight: {obj.weight}</span>
                          {isRejected && obj.managerComments && (
                            <span className="rejection-reason">Manager: {obj.managerComments}</span>
                          )}
                        </div>
                        <span className="status-badge" style={{ backgroundColor: getStatusColor(obj.status) }}>
                          {obj.status}
                        </span>
                        <div className="obj-mini-actions">
                          {canEditObjective(obj) && (
                            <button
                              onClick={function (e) {
                                e.stopPropagation();
                                setSelectedObjective(obj);
                                setObjectiveForm({
                                  title: obj.title,
                                  description: obj.description || '',
                                  category: obj.category || 'individual',
                                  weight: obj.weight,
                                  deadline: formatDateInput(obj.deadline),
                                  cycle: obj.cycle?._id || '',
                                  successIndicator: obj.successIndicator || ''
                                });
                                setShowEventModal(false);
                                setShowObjectiveModal(true);
                              }}
                              className="edit-mini-btn"
                            >
                              Edit
                            </button>
                          )}
                          {canSubmitObjective(obj) && isInEvaluationPeriod(selectedCycle) && (
                            <button onClick={function () { openSubmitModal(obj); }} className="submit-mini-btn">
                              {isRejected ? 'Resubmit' : 'Submit'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-actions">
              {(user.role === 'ADMIN' || user.role === 'HR') && (
                <>
                  <button onClick={function () { openEditCycle(selectedCycle); }} className="edit-btn">
                    Modify
                  </button>
                  <button onClick={function () { handleDeleteCycle(selectedCycle._id); }} className="delete-btn">
                    Delete
                  </button>
                </>
              )}
              <button onClick={function () { setShowEventModal(false); }} className="cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {showCycleModal && (
        <div className="modal-overlay" onClick={function () { setShowCycleModal(false); }}>
          <div className="modal" onClick={function (e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>{selectedCycle ? 'Modify Cycle' : 'New Cycle'}</h3>
              <button onClick={function () { setShowCycleModal(false); }} className="close-btn">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {dateError && <div className="error-message">{dateError}</div>}

            <form onSubmit={handleSaveCycle}>
              <div className="form-row">
                <div className="form-group">
                  <label>Cycle Name:</label>
                  <input
                    type="text"
                    value={cycleForm.name}
                    onChange={function (e) { setCycleForm({ ...cycleForm, name: e.target.value }); }}
                    placeholder="e.g., 2024 Mid-Year Evaluation"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Year:</label>
                  <input
                    type="number"
                    value={cycleForm.year}
                    onChange={function (e) { setCycleForm({ ...cycleForm, year: parseInt(e.target.value) }); }}
                    min="2020"
                    max="2030"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Type:</label>
                <select
                  value={cycleForm.type}
                  onChange={function (e) { setCycleForm({ ...cycleForm, type: e.target.value }); }}
                  required
                >
                  <option value="Mid-Year">Mid-Year</option>
                  <option value="End-Year">End-Year</option>
                </select>
              </div>

              <div className="form-section">
                <h4>Evaluation Period</h4>
                <p className="form-hint">Period when employees submit their self-assessments</p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date:</label>
                    <input
                      type="date"
                      value={cycleForm.evaluationStart}
                      onChange={function (e) {
                        setCycleForm({ ...cycleForm, evaluationStart: e.target.value });
                        setDateError('');
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date:</label>
                    <input
                      type="date"
                      value={cycleForm.evaluationEnd}
                      onChange={function (e) {
                        setCycleForm({ ...cycleForm, evaluationEnd: e.target.value });
                        setDateError('');
                      }}
                      required
                    />
                  </div>
                </div>
              </div>


              <div className="date-validation-hint">
                Dates can be the same day or different days
              </div>

              <div className="modal-actions">
                <button type="submit" className="submit-btn">
                  {selectedCycle ? 'Update Cycle' : 'Create Cycle'}
                </button>
                {selectedCycle && (
                  <button type="button" onClick={function () { handleDeleteCycle(selectedCycle._id); }} className="delete-btn">
                    Delete
                  </button>
                )}
                <button type="button" onClick={function () { setShowCycleModal(false); }} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showObjectiveModal && (
        selectedObjective ? (
          <EditGoalModal
            goal={selectedObjective}
            onClose={function() { setShowObjectiveModal(false); }}
            onUpdated={function() {
              setShowObjectiveModal(false);
              fetchData();
            }}
            cycles={cycles}
            parentGoals={objectives.filter(function(o) { return !o.parentObjective && o._id !== selectedObjective._id; })}
          />
        ) : (
          <CreateGoalModal
            onClose={function() { setShowObjectiveModal(false); }}
            onCreated={function() {
              setShowObjectiveModal(false);
              fetchData();
            }}
            cycles={cycles}
            selectedCycle={objectiveForm.cycle}
            parentGoals={objectives.filter(function(o) { return !o.parentObjective; })}
          />
        )
      )}

      {showSubmitModal && selectedObjective && (
        <div className="modal-overlay" onClick={function () { setShowSubmitModal(false); }}>
          <div className="modal" onClick={function (e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>{selectedObjective.status === 'rejected' ? 'Resubmit' : 'Submit'}: {selectedObjective.title}</h3>
              <button onClick={function () { setShowSubmitModal(false); }} className="close-btn">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {selectedObjective.status === 'rejected' && selectedObjective.managerComments && (
              <div className="rejected-notice">
                <strong>Previous rejection feedback:</strong>
                <p>{selectedObjective.managerComments}</p>
              </div>
            )}

            <div className="submit-info">
              <p><strong>Weight:</strong> {selectedObjective.weight}</p>
              <p><strong>Weighted Score Preview:</strong> {((selectedObjective.weight * submitForm.achievementPercent) / 100).toFixed(2)} / {selectedObjective.weight}</p>
            </div>

            <form onSubmit={handleSubmitObjective}>
              <div className="form-group">
                <label>Achievement: {submitForm.achievementPercent}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={submitForm.achievementPercent}
                  onChange={function (e) { setSubmitForm({ ...submitForm, achievementPercent: parseInt(e.target.value) }); }}
                  className="achievement-slider"
                />
                <div className="achievement-labels">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="form-group">
                <label>Self-Assessment:</label>
                <textarea
                  value={submitForm.selfAssessment}
                  onChange={function (e) { setSubmitForm({ ...submitForm, selfAssessment: e.target.value }); }}
                  placeholder="Describe your achievements, challenges, and learnings..."
                  rows={5}
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="submit-btn">
                  {selectedObjective.status === 'rejected' ? 'Resubmit' : 'Submit'}
                </button>
                <button type="button" onClick={function () { setShowSubmitModal(false); }} className="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Evaluations;