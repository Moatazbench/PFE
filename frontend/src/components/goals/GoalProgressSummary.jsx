import React from 'react';
import ProgressDonut from '../dashboard/ProgressDonut';
import GoalStatusBadge from './GoalStatusBadge';

function GoalProgressSummary({ objectives }) {
    var approvedObjectives = objectives.filter(function(o) {
        return o.status === 'approved' || o.status === 'validated';
    });
    
    var total = approvedObjectives.length;
    var avgProgress = total > 0 ? approvedObjectives.reduce(function (sum, o) { return sum + (o.achievementPercent || 0); }, 0) / total : 0;

    return (
        <div className="goals-progress-summary" style={{ justifyContent: 'center' }}>
            <div className="goals-progress-summary__donut">
                <ProgressDonut percent={Math.round(avgProgress)} size={100} color="#7C3AED" label="Overall" />
            </div>
        </div>
    );
}

export default GoalProgressSummary;
