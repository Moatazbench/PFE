import React from 'react';
import axios from 'axios';

function ExportPDF({ type, id, label }) {
  const API_BASE_URL = 'http://localhost:5000';

  async function handleExport() {
    try {
      const res = await axios.get(
        API_BASE_URL + '/api/pdf/' + type + '/' + id,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = type + '-report-' + id + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Error exporting PDF');
    }
  }

  return (
    <button onClick={handleExport} className="export-btn">
      📄 {label || 'Export PDF'}
    </button>
  );
}

export default ExportPDF;