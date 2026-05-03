import React from 'react';
import api from '../services/api';

function ExportPDF({ type, id, label }) {
  async function handleExport() {
    try {
      const res = await api.get(
        '/api/pdf/' + type + '/' + id,
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