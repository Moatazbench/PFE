import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import GoalProgressBar from './GoalProgressBar';
import GoalStatusBadge from './GoalStatusBadge';
import UserAvatar from '../UserAvatar';
import './GoalAlignmentTree.css';

function GoalNode({ goal, level = 0 }) {
  const [children, setChildren] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchChildren = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.get(`/api/objectives/${goal._id}/children`);
      setChildren(res.data.objectives || []);
      setExpanded(true);
    } catch (err) {
      console.error('Failed to fetch sub-goals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch level 0's children
    if (level === 0) {
      fetchChildren();
    }
  }, [level]);

  return (
    <div className={`goal-tree-node level-${level}`}>
      <div className="goal-tree-card" onClick={fetchChildren}>
        <div className="goal-tree-card-top">
          <span className="goal-tree-title">{goal.title}</span>
          <div className="goal-tree-badges">
            <span className="goal-tree-weight">{goal.weight}%</span>
          </div>
        </div>
        <div className="goal-tree-card-bottom">
          <div className="goal-tree-owner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserAvatar user={goal.owner} size={24} /> 
              <span>{goal.owner?.name || 'Unknown'}</span>
          </div>
          <div style={{ width: '100px' }}>
            <GoalProgressBar percent={goal.achievementPercent || 0} size="small" />
          </div>
        </div>
        {/* Connection line indicator */}
        <div className={`goal-tree-expand-icon ${expanded ? 'expanded' : ''}`}>
          {expanded ? '▾' : '▸'}
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div className="goal-tree-children">
          {children.map(child => (
            <GoalNode key={child._id} goal={child} level={level + 1} />
          ))}
        </div>
      )}
      
      {expanded && children.length === 0 && level > 0 && (
        <div className="goal-tree-empty-children">
          No sub-goals.
        </div>
      )}
    </div>
  );
}

function GoalAlignmentTree({ rootGoal }) {
  const [parentGoal, setParentGoal] = useState(null);
  const [loadingParent, setLoadingParent] = useState(true);

  useEffect(() => {
    // If rootGoal has a parent, try to fetch it to show upward alignment
    const fetchParent = async () => {
      if (!rootGoal.parentObjective) {
        setLoadingParent(false);
        return;
      }
      try {
        const parentId = typeof rootGoal.parentObjective === 'object' ? rootGoal.parentObjective._id : rootGoal.parentObjective;
        const res = await api.get(`/api/objectives/${parentId}`);
        setParentGoal(res.data.objective || res.data);
      } catch (err) {
        console.error('Failed to fetch parent goal', err);
      } finally {
        setLoadingParent(false);
      }
    };
    fetchParent();
  }, [rootGoal]);

  if (loadingParent) return <div className="goal-tree-loading">Loading alignment...</div>;

  return (
    <div className="goal-alignment-tree">
      {parentGoal && (
        <>
          <div className="goal-tree-parent-section">
            <div className="goal-tree-label">Aligns To</div>
            <div className="goal-tree-card parent-card">
               <div className="goal-tree-card-top">
                <span className="goal-tree-title">{parentGoal.title}</span>
              </div>
              <div className="goal-tree-card-bottom">
                <div className="goal-tree-owner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserAvatar user={parentGoal.owner} size={24} /> 
                    <span>{parentGoal.owner?.name || 'Unknown'}</span>
                </div>
                <div style={{ width: '100px' }}><GoalProgressBar percent={parentGoal.achievementPercent || 0} size="small" /></div>
              </div>
            </div>
            <div className="goal-tree-connector-down"></div>
          </div>
        </>
      )}

      {/* The current goal acts as the "root" of its downward tree */}
      <div className="goal-tree-label">This Goal</div>
      <GoalNode goal={rootGoal} level={0} />
    </div>
  );
}

export default GoalAlignmentTree;
