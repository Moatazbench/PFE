import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import FinalEvaluationManager from './FinalEvaluationManager';

function FinalEvaluationReportPage() {
  const { cycleId, employeeId } = useParams();
  const toast = useToast();
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/cycles')
      .then((response) => {
        if (cancelled) return;
        const match = (response.data || []).find((item) => String(item._id) === String(cycleId));
        setCycle(match || null);
        if (!match) toast.error('Evaluation cycle not found.');
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load the evaluation cycle.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cycleId, toast]);

  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Loading report workspace...</p></div>;
  if (!cycle) return <div className="empty-state">Evaluation cycle not found.</div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <FinalEvaluationManager cycleId={cycleId} activeCycle={cycle} reportEmployeeId={employeeId} />
    </div>
  );
}

export default FinalEvaluationReportPage;
