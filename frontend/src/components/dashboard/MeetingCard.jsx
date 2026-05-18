import React from 'react';
import { Link } from 'react-router-dom';
import LoadingSkeleton from '../common/LoadingSkeleton';

function getMeetingTypeLabel(type) {
  return {
    one_on_one: '1:1',
    team: 'Team',
    all_hands: 'All hands',
    check_in: 'Check-in',
    review: 'Review',
    planning: 'Planning',
    other: 'Other',
  }[type] || 'Meeting';
}

function MeetingCard({ meetings, loading, error }) {
  var upcomingMeetings = (meetings || []).slice().sort(function (left, right) {
    return new Date(left?.date || 0) - new Date(right?.date || 0);
  }).slice(0, 4);

  return (
    <div className="dash-card dash-card--meetings">
      <div className="dash-card__header">
        <div>
          <h3>Upcoming meetings</h3>
          <p className="dash-card__subtitle">Next scheduled conversations and reviews</p>
        </div>
        <span className="dash-card__count">{meetings?.length || 0}</span>
      </div>

      <div className="dash-card__body">
        {loading ? (
          <LoadingSkeleton rows={3} height={62} />
        ) : error ? (
          <div className="dash-card__empty-state">
            <p>Meetings could not be loaded.</p>
            <span className="dash-card__empty-hint">{error}</span>
          </div>
        ) : upcomingMeetings.length === 0 ? (
          <div className="dash-card__empty-state">
            <p>No upcoming meetings</p>
            <Link to="/meetings" className="dash-card__link">Open meetings</Link>
          </div>
        ) : (
          <div className="dash-card__list">
            {upcomingMeetings.map(function (meeting) {
              return (
                <div key={meeting._id} className="dash-meeting-row">
                  <div className="dash-meeting-row__top">
                    <span className="dash-meeting-row__title">{meeting.title}</span>
                    <span className="dash-meeting-row__badge">{getMeetingTypeLabel(meeting.type)}</span>
                  </div>
                  <div className="dash-meeting-row__meta">
                    <span>{new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span>{meeting.startTime} - {meeting.endTime}</span>
                    <span>{(meeting.attendees || meeting.participants || []).length} attendees</span>
                  </div>
                </div>
              );
            })}
            <Link to="/meetings" className="dash-card__link">View all meetings</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(MeetingCard);
