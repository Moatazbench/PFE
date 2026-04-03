import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

function MeetingsPage() {
    var { user } = useAuth();
    var toast = useToast();
    var [meetings, setMeetings] = useState([]);
    var [users, setUsers] = useState([]);
    var [teams, setTeams] = useState([]);
    var [loading, setLoading] = useState(true);
    var [showModal, setShowModal] = useState(false);
    var [isEditing, setIsEditing] = useState(false);
    var [editingId, setEditingId] = useState(null);
    var [showDetail, setShowDetail] = useState(null);
    var [filter, setFilter] = useState('upcoming');
    var fetchIdRef = React.useRef(0);

    var [form, setForm] = useState({
        title: '', description: '', date: '', startTime: '09:00', endTime: '10:00',
        type: 'team', attendees: [], team: '', recurring: 'none', location: '',
    });

    async function fetchMeetings() {
        var currentFetchId = ++fetchIdRef.current;
        try {
            // Append unique timestamp to bypass any browser/proxy cache
            var params = { t: Date.now() };
            if (filter === 'upcoming') { params.upcoming = 'true'; params.status = 'scheduled,in_progress'; }
            if (filter === 'completed') params.status = 'completed';
            if (filter === 'cancelled') params.status = 'cancelled';
            var res = await api.get('/api/meetings', { params: params });
            if (currentFetchId === fetchIdRef.current) {
                setMeetings(res.data.meetings || []);
            }
        } catch (err) {
            console.error('Meetings fetch error:', err);
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }

    async function fetchUsers() {
        try {
            var res = await api.get('/api/users');
            setUsers(res.data.users || res.data || []);
        } catch (err) { console.error(err); }
    }

    async function fetchTeams() {
        try {
            var res = await api.get('/api/teams');
            setTeams(Array.isArray(res.data) ? res.data : (res.data.teams || []));
        } catch (err) { /* Collaborators may not have access */ }
    }

    useEffect(function () { fetchUsers(); fetchTeams(); }, []);
    useEffect(function () { setLoading(true); fetchMeetings(); }, [filter]);

    function openCreateModal() {
        var now = new Date();
        var nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        var endHour = new Date(nextHour);
        endHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        var formatTime = function(d) { return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };
        var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        setForm({ 
            title: '', description: '', date: todayStr, 
            startTime: formatTime(nextHour), endTime: formatTime(endHour), 
            type: 'team', attendees: [], team: '', recurring: 'none', location: '' 
        });
        setIsEditing(false);
        setEditingId(null);
        setShowModal(true);
    }

    function openEditModal(meeting) {
        setForm({
            title: meeting.title || '',
            description: meeting.description || '',
            date: meeting.date ? meeting.date.substring(0, 10) : '',
            startTime: meeting.startTime || '09:00',
            endTime: meeting.endTime || '10:00',
            type: meeting.type || 'team',
            attendees: (meeting.attendees || []).map(a => typeof a === 'object' ? a._id : a),
            team: meeting.team ? (typeof meeting.team === 'object' ? meeting.team._id : meeting.team) : '',
            recurring: meeting.recurring || 'none',
            location: meeting.location || ''
        });
        setIsEditing(true);
        setEditingId(meeting._id);
        setShowModal(true);
    }

    async function handleCreate(e) {
        e.preventDefault();
        try {
            var res;
            if (isEditing) {
                res = await api.put('/api/meetings/' + editingId, form);
                toast.success('Meeting updated!');
            } else {
                res = await api.post('/api/meetings', form);
                toast.success('Meeting created!');
            }
            setShowModal(false);
            
            // Increment fetchIdRef to invalidate any pending heartbeats
            fetchIdRef.current += 1;
            
            // Instantly update local UI
            if (res && res.data && res.data.meeting) {
                var newMeeting = res.data.meeting;
                setMeetings(function(prev) {
                    if (isEditing) {
                        return prev.map(function(m) { return m._id === editingId ? newMeeting : m; });
                    } else {
                        // Include seamlessly in the view
                        if (filter === 'upcoming' && (newMeeting.status === 'scheduled' || newMeeting.status === 'in_progress')) {
                            return [newMeeting].concat(prev);
                        } else if (filter === 'all' || filter === newMeeting.status) {
                            return [newMeeting].concat(prev);
                        }
                        return prev;
                    }
                });
            }
            
            fetchMeetings();
            if (showDetail && showDetail._id === editingId) {
                if (res && res.data && res.data.meeting) {
                    setShowDetail(res.data.meeting);
                } else {
                    res = await api.get('/api/meetings/' + editingId);
                    setShowDetail(res.data.meeting);
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || (isEditing ? 'Failed to update meeting' : 'Failed to create meeting'));
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete('/api/meetings/' + id);
            toast.success('Meeting deleted');
            fetchMeetings();
            if (showDetail && showDetail._id === id) setShowDetail(null);
        } catch (err) {
            toast.error('Failed to delete meeting');
        }
    }

    async function handleDuplicate(id) {
        try {
            await api.post('/api/meetings/' + id + '/duplicate');
            toast.success('Meeting duplicated!');
            fetchMeetings();
        } catch (err) {
            toast.error('Failed to duplicate');
        }
    }

    async function handleStatusChange(id, status) {
        try {
            await api.put('/api/meetings/' + id, { status });
            toast.success('Status updated');
            fetchMeetings();
            if (showDetail && showDetail._id === id) {
                var res = await api.get('/api/meetings/' + id);
                setShowDetail(res.data.meeting);
            }
        } catch (err) {
            toast.error('Failed to update status');
        }
    }

    async function handleSaveNotes(id, notes) {
        try {
            await api.put('/api/meetings/' + id, { notes });
            toast.success('Notes saved');
            var res = await api.get('/api/meetings/' + id);
            setShowDetail(res.data.meeting);
        } catch (err) {
            toast.error('Failed to save notes');
        }
    }

    function toggleAttendee(userId) {
        setForm(function (prev) {
            var arr = prev.attendees.slice();
            var idx = arr.indexOf(userId);
            if (idx > -1) arr.splice(idx, 1);
            else arr.push(userId);
            return Object.assign({}, prev, { attendees: arr });
        });
    }

    function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
    function getTypeIcon(type) { return { one_on_one: '👤', team: '👥', all_hands: '🏢', check_in: '✅', review: '📊', planning: '📋', other: '📌' }[type] || '📌'; }
    function getStatusColor(status) { return { scheduled: '#6c5ce7', in_progress: '#0984e3', completed: '#00b894', cancelled: '#d63031' }[status] || '#636e72'; }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header__left">
                    <h1 className="page-title">📅 Meetings</h1>
                    <p className="page-subtitle">Schedule and manage your 1-on-1s and team meetings</p>
                </div>
                <button onClick={openCreateModal} className="btn btn--primary">+ New Meeting</button>
            </div>

            {/* Filter Tabs */}
            <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
                {['upcoming', 'all', 'completed', 'cancelled'].map(function (f) {
                    return <button key={f}
                        className={'tab-btn' + (filter === f ? ' tab-btn--active' : '')}
                        onClick={function () { setFilter(f); }}
                    >{f.charAt(0).toUpperCase() + f.slice(1)}</button>;
                })}
            </div>

            {loading ? (
                <LoadingSkeleton rows={4} height={100} />
            ) : meetings.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">📅</div>
                    <h3>No meetings found</h3>
                    <p>Schedule your first meeting to get started</p>
                    <button className="btn btn--primary" onClick={openCreateModal}>+ New Meeting</button>
                </div>
            ) : (
                <div className="meetings-grid">
                    {meetings.map(function (meeting) {
                        return (
                            <div key={meeting._id} className="meeting-card" onClick={function () { setShowDetail(meeting); }}>
                                <div className="meeting-card__header">
                                    <span className="meeting-card__type">{getTypeIcon(meeting.type)} {meeting.type.replace('_', ' ')}</span>
                                    <span className="status-chip" style={{ background: getStatusColor(meeting.status) + '20', color: getStatusColor(meeting.status), border: '1px solid ' + getStatusColor(meeting.status) + '40' }}>{meeting.status}</span>
                                </div>
                                <h3 className="meeting-card__title">{meeting.title}</h3>
                                <div className="meeting-card__meta">
                                    <span>📅 {formatDate(meeting.date)}</span>
                                    <span>🕐 {meeting.startTime || '—'} – {meeting.endTime || '—'}</span>
                                    {meeting.location && <span>📍 {meeting.location}</span>}
                                </div>
                                {meeting.attendees && meeting.attendees.length > 0 && (
                                    <div className="meeting-card__attendees">
                                        {meeting.attendees.slice(0, 4).map(function (a) {
                                            return <span key={a._id} className="meeting-card__avatar" title={a.name}>{a.name ? a.name.charAt(0).toUpperCase() : '?'}</span>;
                                        })}
                                        {meeting.attendees.length > 4 && <span className="meeting-card__avatar meeting-card__avatar--more">+{meeting.attendees.length - 4}</span>}
                                    </div>
                                )}
                                {meeting.recurring !== 'none' && <span className="meta-tag">🔄 {meeting.recurring}</span>}
                                <div className="meeting-card__actions" onClick={function (e) { e.stopPropagation(); }}>
                                    {meeting.status === 'scheduled' && <button className="btn btn--secondary btn--sm" onClick={function () { handleStatusChange(meeting._id, 'in_progress'); }}>▶ Start</button>}
                                    {meeting.status === 'in_progress' && <button className="btn btn--primary btn--sm" onClick={function () { handleStatusChange(meeting._id, 'completed'); }}>✓ Complete</button>}
                                    <button className="btn btn--ghost btn--sm" onClick={function () { openEditModal(meeting); }}>✏️ Edit</button>
                                    <button className="btn btn--ghost btn--sm" onClick={function () { handleDuplicate(meeting._id); }}>📋 Duplicate</button>
                                    <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={function (e) { e.stopPropagation(); handleDelete(meeting._id); }}>🗑️</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={function () { setShowModal(false); }}>
                    <div className="modal-content" onClick={function (e) { e.stopPropagation(); }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{isEditing ? 'Edit Meeting' : 'Create New Meeting'}</h2>
                            <button className="modal-close" onClick={function () { setShowModal(false); }}>✕</button>
                        </div>
                        <form className="form-grid" onSubmit={handleCreate}>
                            <div className="form-group form-group--full">
                                <label>Meeting Title *</label>
                                <input className="form-input" type="text" value={form.title} onChange={function (e) { setForm(Object.assign({}, form, { title: e.target.value })); }} placeholder="e.g. Weekly Team Sync" required />
                            </div>
                            <div className="form-group form-group--full">
                                <label>Description</label>
                                <textarea className="form-textarea" value={form.description} onChange={function (e) { setForm(Object.assign({}, form, { description: e.target.value })); }} rows={2} placeholder="Meeting agenda overview..." />
                            </div>
                            <div className="form-group">
                                <label>Date *</label>
                                <input className="form-input" type="date" value={form.date} onChange={function (e) { setForm(Object.assign({}, form, { date: e.target.value })); }} required />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select className="form-select" value={form.type} onChange={function (e) { setForm(Object.assign({}, form, { type: e.target.value })); }}>
                                    <option value="team">Team</option>
                                    <option value="one_on_one">One-on-One</option>
                                    <option value="all_hands">All Hands</option>
                                    <option value="check_in">Check-in</option>
                                    <option value="review">Review</option>
                                    <option value="planning">Planning</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Start Time</label>
                                <input className="form-input" type="time" value={form.startTime} onChange={function (e) { setForm(Object.assign({}, form, { startTime: e.target.value })); }} />
                            </div>
                            <div className="form-group">
                                <label>End Time</label>
                                <input className="form-input" type="time" value={form.endTime} onChange={function (e) { setForm(Object.assign({}, form, { endTime: e.target.value })); }} />
                            </div>
                            <div className="form-group">
                                <label>Recurring</label>
                                <select className="form-select" value={form.recurring} onChange={function (e) { setForm(Object.assign({}, form, { recurring: e.target.value })); }}>
                                    <option value="none">None</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Bi-weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Location</label>
                                <input className="form-input" type="text" value={form.location} onChange={function (e) { setForm(Object.assign({}, form, { location: e.target.value })); }} placeholder="Room / Video link" />
                            </div>
                            {teams.length > 0 && (
                                <div className="form-group">
                                    <label>Team</label>
                                    <select className="form-select" value={form.team} onChange={function (e) { setForm(Object.assign({}, form, { team: e.target.value })); }}>
                                        <option value="">None</option>
                                        {teams.map(function (t) { return <option key={t._id} value={t._id}>{t.name}</option>; })}
                                    </select>
                                </div>
                            )}
                            <div className="form-group form-group--full">
                                <label>Attendees</label>
                                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                                    {users.map(function (u) {
                                        var isSelected = form.attendees.includes(u._id);
                                        return (
                                            <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? 'var(--primary-light)' : 'transparent' }}>
                                                <input type="checkbox" checked={isSelected} onChange={function () { toggleAttendee(u._id); }} />
                                                <span>{u.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({u.role})</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="form-hint">Selected: {form.attendees.length} attendee(s)</p>
                            </div>
                            <div className="form-actions form-group--full">
                                <button type="button" className="btn btn--secondary" onClick={function () { setShowModal(false); }}>Cancel</button>
                                <button type="submit" className="btn btn--primary">{isEditing ? 'Save Changes' : 'Create Meeting'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Panel */}
            {showDetail && (
                <MeetingDetailPanel
                    meeting={showDetail}
                    onClose={function () { setShowDetail(null); }}
                    onRefresh={fetchMeetings}
                    onSaveNotes={handleSaveNotes}
                    onStatusChange={handleStatusChange}
                    onEdit={function (m) { setShowDetail(null); openEditModal(m); }}
                    toast={toast}
                />
            )}
        </div>
    );
}

function MeetingDetailPanel({ meeting, onClose, onRefresh, onSaveNotes, onStatusChange, onEdit, toast }) {
    var [activeTab, setActiveTab] = useState('details');
    var [notes, setNotes] = useState(meeting.notes || '');
    var [detail, setDetail] = useState(meeting);
    var [savingNotes, setSavingNotes] = useState(false);
    var [newAgendaItem, setNewAgendaItem] = useState('');
    var [newActionItem, setNewActionItem] = useState('');

    useEffect(function () {
        fetchDetail();
    }, [meeting._id]);

    async function fetchDetail() {
        try {
            var res = await api.get('/api/meetings/' + meeting._id);
            setDetail(res.data.meeting || meeting);
            setNotes(res.data.meeting?.notes || meeting.notes || '');
        } catch (err) { console.error(err); }
    }

    async function saveNotes() {
        setSavingNotes(true);
        await onSaveNotes(detail._id, notes);
        setSavingNotes(false);
    }

    async function addAgendaItem() {
        if (!newAgendaItem.trim()) return;
        try {
            var updatedAgenda = [...(detail.agenda || []), { title: newAgendaItem, duration: 5, completed: false }];
            await api.put('/api/meetings/' + detail._id, { agenda: updatedAgenda });
            toast.success('Agenda item added');
            setNewAgendaItem('');
            fetchDetail();
        } catch (err) { toast.error('Failed to add agenda item'); }
    }

    async function toggleAgendaItem(index) {
        try {
            var updatedAgenda = (detail.agenda || []).map(function (item, i) {
                return i === index ? Object.assign({}, item, { completed: !item.completed }) : item;
            });
            await api.put('/api/meetings/' + detail._id, { agenda: updatedAgenda });
            fetchDetail();
        } catch (err) { toast.error('Failed to update agenda item'); }
    }

    async function addActionItem() {
        if (!newActionItem.trim()) return;
        try {
            var updatedActions = [...(detail.actionItems || []), { title: newActionItem, completed: false }];
            await api.put('/api/meetings/' + detail._id, { actionItems: updatedActions });
            toast.success('Action item added');
            setNewActionItem('');
            fetchDetail();
        } catch (err) { toast.error('Failed to add action item'); }
    }

    async function toggleActionItem(index) {
        try {
            var updatedActions = (detail.actionItems || []).map(function (item, i) {
                return i === index ? Object.assign({}, item, { completed: !item.completed }) : item;
            });
            await api.put('/api/meetings/' + detail._id, { actionItems: updatedActions });
            fetchDetail();
        } catch (err) { toast.error('Failed to update action item'); }
    }

    function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'; }
    function getStatusColor(status) { return { scheduled: '#6c5ce7', in_progress: '#0984e3', completed: '#00b894', cancelled: '#d63031' }[status] || '#636e72'; }

    var tabs = ['details', 'agenda', 'notes', 'actions'];

    return (
        <div className="side-panel-overlay" onClick={onClose}>
            <div className="side-panel" onClick={function (e) { e.stopPropagation(); }}>
                <div className="side-panel__header">
                    <div>
                        <h2 className="side-panel__title">{detail.title}</h2>
                        <p className="side-panel__subtitle">{detail.description || 'No description'}</p>
                    </div>
                    <button className="side-panel__close" onClick={onClose}>✕</button>
                </div>

                <div className="side-panel__actions">
                    <span className="status-chip" style={{ background: getStatusColor(detail.status) + '20', color: getStatusColor(detail.status) }}>{detail.status}</span>
                    <button className="btn btn--secondary btn--sm" onClick={function () { onEdit(detail); }}>✏️ Edit</button>
                    {detail.status === 'scheduled' && <button className="btn btn--secondary btn--sm" onClick={function () { onStatusChange(detail._id, 'in_progress'); }}>▶ Start Meeting</button>}
                    {detail.status === 'in_progress' && <button className="btn btn--primary btn--sm" onClick={function () { onStatusChange(detail._id, 'completed'); }}>✓ Mark Complete</button>}
                </div>

                <div className="tab-bar tab-bar--sm">
                    {tabs.map(function (tab) {
                        return <button key={tab} className={'tab-btn' + (activeTab === tab ? ' tab-btn--active' : '')} onClick={function () { setActiveTab(tab); }}>
                            {tab === 'agenda' ? `Agenda (${(detail.agenda || []).length})` : tab === 'actions' ? `Actions (${(detail.actionItems || []).length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>;
                    })}
                </div>

                <div className="side-panel__content">
                    {activeTab === 'details' && (
                        <div className="detail-rows">
                            <div className="detail-row"><span>Organizer</span><span>{detail.organizer?.name || 'Unknown'}</span></div>
                            <div className="detail-row"><span>Date</span><span>{formatDate(detail.date)}</span></div>
                            <div className="detail-row"><span>Time</span><span>{detail.startTime} – {detail.endTime}</span></div>
                            <div className="detail-row"><span>Type</span><span>{detail.type?.replace(/_/g, ' ')}</span></div>
                            <div className="detail-row"><span>Recurring</span><span>{detail.recurring === 'none' ? 'Not recurring' : detail.recurring}</span></div>
                            <div className="detail-row"><span>Location</span><span>{detail.location || '—'}</span></div>
                            <div className="detail-row"><span>Team</span><span>{detail.team?.name || '—'}</span></div>
                            <div className="detail-row">
                                <span>Attendees</span>
                                <span>{(detail.attendees || []).map(function (a) { return a.name; }).join(', ') || 'None'}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'agenda' && (
                        <div>
                            <div className="checklist">
                                {(detail.agenda || []).length === 0 ? (
                                    <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No agenda items yet</p>
                                ) : (
                                    (detail.agenda || []).map(function (item, i) {
                                        return (
                                            <div key={i} className="checklist-item" onClick={function () { toggleAgendaItem(i); }}>
                                                <span className="checklist-item__check">{item.completed ? '✅' : '⬜'}</span>
                                                <span className={'checklist-item__text' + (item.completed ? ' checklist-item__text--done' : '')}>{item.title}</span>
                                                <span className="checklist-item__meta">{item.duration} min</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="add-item-row">
                                <input className="form-input" placeholder="Add agenda item..." value={newAgendaItem} onChange={function (e) { setNewAgendaItem(e.target.value); }} onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); addAgendaItem(); } }} />
                                <button className="btn btn--primary btn--sm" onClick={addAgendaItem}>Add</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div>
                            <textarea
                                className="form-textarea"
                                value={notes}
                                onChange={function (e) { setNotes(e.target.value); }}
                                rows={12}
                                placeholder="Type meeting notes here..."
                                style={{ width: '100%' }}
                            />
                            <button className="btn btn--primary" style={{ marginTop: '8px' }} onClick={saveNotes} disabled={savingNotes}>
                                {savingNotes ? 'Saving...' : '💾 Save Notes'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div>
                            <div className="checklist">
                                {(detail.actionItems || []).length === 0 ? (
                                    <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No action items yet</p>
                                ) : (
                                    (detail.actionItems || []).map(function (item, i) {
                                        return (
                                            <div key={i} className="checklist-item" onClick={function () { toggleActionItem(i); }}>
                                                <span className="checklist-item__check">{item.completed ? '✅' : '⬜'}</span>
                                                <div style={{ flex: 1 }}>
                                                    <span className={'checklist-item__text' + (item.completed ? ' checklist-item__text--done' : '')}>{item.title}</span>
                                                    {item.assignee && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>👤 {item.assignee.name}</div>}
                                                    {item.dueDate && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📅 {new Date(item.dueDate).toLocaleDateString()}</div>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="add-item-row">
                                <input className="form-input" placeholder="Add action item..." value={newActionItem} onChange={function (e) { setNewActionItem(e.target.value); }} onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); addActionItem(); } }} />
                                <button className="btn btn--primary btn--sm" onClick={addActionItem}>Add</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MeetingsPage;
