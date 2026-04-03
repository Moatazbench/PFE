import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ProgressChart({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = 'http://localhost:5000';

  useEffect(function() {
    async function fetchProgress() {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await axios.get(API_BASE_URL + '/api/progress/' + userId);
        setData(res.data);
      } catch (err) {
        console.error('Fetch progress error:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProgress();
  }, [userId]);

  if (loading) {
    return <p>Loading chart...</p>;
  }
  
  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className="progress-chart">
        <h3>Employee Progress</h3>
        <p>No evaluation data available yet.</p>
      </div>
    );
  }

  const maxValue = Math.max.apply(null, data.values.concat([100]));

  return (
    <div className="progress-chart">
      <h3>Employee Progress Over Time</h3>
      <div className="simple-chart">
        {data.labels.map(function(label, index) {
          const heightPercent = (data.values[index] / maxValue) * 100;
          return (
            <div key={index} className="chart-bar-container">
              <div
                className="chart-bar"
                style={{
                  height: heightPercent + '%',
                  backgroundColor: '#4CAF50'
                }}
              >
                <span className="bar-value">{data.values[index]}</span>
              </div>
              <span className="bar-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProgressChart;