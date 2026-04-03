// src/components/evaluations/ReportModal.jsx
// Modal for submitting evaluation reports

import React, { useState, useEffect, useRef } from 'react';
import { fetchMyReports, submitReport, uploadAttachments, deleteAttachment } from '../../api/reports';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    color: '#111827',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    lineHeight: '1',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  progressSummary: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  summaryItem: {
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  objectivesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  objectiveCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  objectiveHeader: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  objectiveHeaderLeft: {
    flex: 1,
  },
  objectiveTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  objectiveDescription: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },
  objectiveMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  weightBadge: {
    padding: '4px 8px',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  statusSubmitted: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  expandIcon: {
    fontSize: '18px',
    transition: 'transform 0.2s',
    marginLeft: '12px',
  },
  objectiveBody: {
    padding: '16px',
    borderTop: '1px solid #e5e7eb',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressSlider: {
    flex: 1,
    height: '8px',
    WebkitAppearance: 'none',
    appearance: 'none',
    borderRadius: '4px',
    background: 'linear-gradient(to right, #10b981 0%, #10b981 var(--progress), #e5e7eb var(--progress), #e5e7eb 100%)',
    outline: 'none',
    cursor: 'pointer',
  },
  progressValue: {
    minWidth: '50px',
    textAlign: 'right',
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  fileUploadContainer: {
    marginTop: '8px',
  },
  fileUpload: {
    border: '2px dashed #d1d5db',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#fafafa',
  },
  fileUploadDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  fileUploadHover: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  fileUploadIcon: {
    fontSize: '36px',
    marginBottom: '8px',
  },
  fileUploadText: {
    color: '#6b7280',
    fontSize: '14px',
  },
  fileUploadSubtext: {
    color: '#9ca3af',
    fontSize: '12px',
    marginTop: '4px',
  },
  attachmentsList: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
  },
  attachmentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
  },
  attachmentIcon: {
    fontSize: '20px',
  },
  attachmentDetails: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  attachmentSize: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  attachmentActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  smallBtn: {
    padding: '6px 10px',
    fontSize: '12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  downloadBtn: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    textDecoration: 'none',
    display: 'inline-block',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  objectiveActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  },
  btnPrimary: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  btnSuccess: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280',
  },
  loadingSpinner: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#b91c1c',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  success: {
    padding: '12px 16px',
    backgroundColor: '#d1fae5',
    border: '1px solid #a7f3d0',
    borderRadius: '6px',
    color: '#065f46',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
  },
};

export default function ReportModal({ isOpen, onClose, cycle }) {
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Form state for each objective
  const [formData, setFormData] = useState({});
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState({});

  // File input refs
  const fileInputRefs = useRef({});

  // Load objectives and reports when modal opens
  useEffect(() => {
    if (isOpen && cycle) {
      loadReports();
    } else {
      // Reset state when modal closes
      setObjectives([]);
      setFormData({});
      setExpandedId(null);
      setError('');
      setSuccess('');
    }
  }, [isOpen, cycle]);

  const loadReports = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchMyReports(cycle._id);
      const objectivesData = data.objectives || [];
      setObjectives(objectivesData);

      // Initialize form data for each objective
      const initialFormData = {};
      objectivesData.forEach((obj) => {
        const objectiveId = obj.objective._id;
        initialFormData[objectiveId] = {
          progress: obj.report?.progress || 0,
          comments: obj.report?.comments || '',
          attachments: obj.report?.attachments || [],
          reportId: obj.report?._id || null,
        };
      });
      setFormData(initialFormData);

      // Auto-expand first objective if only one
      if (objectivesData.length === 1) {
        setExpandedId(objectivesData[0].objective._id);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err.message || 'Failed to load objectives');
    } finally {
      setLoading(false);
    }
  };

  // Toggle expand/collapse objective
  const toggleExpand = (objectiveId) => {
    setExpandedId(expandedId === objectiveId ? null : objectiveId);
  };

  // Update form data for a specific objective
  const updateFormData = (objectiveId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [objectiveId]: {
        ...prev[objectiveId],
        [field]: value,
      },
    }));
  };

  // Handle file selection
  const handleFileSelect = async (objectiveId, files) => {
    if (!files || files.length === 0) return;

    const data = formData[objectiveId];

    // Check if report exists
    if (!data.reportId) {
      setError('Please save the report first before uploading files');
      return;
    }

    setUploading((prev) => ({ ...prev, [objectiveId]: true }));
    setError('');

    try {
      const result = await uploadAttachments(data.reportId, Array.from(files));

      // Update attachments in form data
      setFormData((prev) => ({
        ...prev,
        [objectiveId]: {
          ...prev[objectiveId],
          attachments: result.attachments || [],
        },
      }));

      setSuccess(`${files.length} file(s) uploaded successfully`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading((prev) => ({ ...prev, [objectiveId]: false }));
      // Reset file input
      if (fileInputRefs.current[objectiveId]) {
        fileInputRefs.current[objectiveId].value = '';
      }
    }
  };

  // Handle delete attachment
  const handleDeleteAttachment = async (objectiveId, attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    const data = formData[objectiveId];

    try {
      await deleteAttachment(data.reportId, attachmentId);

      // Remove from local state
      setFormData((prev) => ({
        ...prev,
        [objectiveId]: {
          ...prev[objectiveId],
          attachments: prev[objectiveId].attachments.filter(
            (a) => a._id !== attachmentId
          ),
        },
      }));

      setSuccess('Attachment deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Delete attachment error:', err);
      setError(err.message || 'Failed to delete attachment');
    }
  };

  // Handle submit/update report
  const handleSubmitReport = async (objectiveId) => {
    const data = formData[objectiveId];

    setSubmitting((prev) => ({ ...prev, [objectiveId]: true }));
    setError('');

    try {
      const result = await submitReport({
        cycleId: cycle._id,
        objectiveId,
        progress: data.progress,
        comments: data.comments,
      });

      // Update form data with new report ID
      setFormData((prev) => ({
        ...prev,
        [objectiveId]: {
          ...prev[objectiveId],
          reportId: result.report._id,
          attachments: result.report.attachments || prev[objectiveId].attachments,
        },
      }));

      // Reload to get updated status
      await loadReports();

      setSuccess('Report submitted successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Submit report error:', err);
      setError(err.message || 'Failed to submit report');
    } finally {
      setSubmitting((prev) => ({ ...prev, [objectiveId]: false }));
    }
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get file icon based on mimetype
  const getFileIcon = (mimetype) => {
    if (!mimetype) return '📎';
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
    if (mimetype.includes('image')) return '🖼️';
    if (mimetype.includes('video')) return '🎬';
    if (mimetype.includes('audio')) return '🎵';
    if (mimetype.includes('zip') || mimetype.includes('rar')) return '📦';
    return '📎';
  };

  // Get download URL for attachment
  const getDownloadUrl = (reportId, attachmentId) => {
    return `${API_BASE_URL}/api/reports/${reportId}/attachments/${attachmentId}/download`;
  };

  // Calculate summary statistics
  const submittedCount = objectives.filter((o) => o.isSubmitted).length;
  const totalObjectives = objectives.length;
  const completionPercentage = totalObjectives > 0
    ? Math.round((submittedCount / totalObjectives) * 100)
    : 0;

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <h2 style={styles.title}>📝 {cycle?.name || 'Submit Reports'}</h2>
            <p style={styles.subtitle}>
              Submission Window: {' '}
              {cycle?.submissionStart
                ? new Date(cycle.submissionStart).toLocaleDateString()
                : 'N/A'}{' '}
              -{' '}
              {cycle?.submissionEnd
                ? new Date(cycle.submissionEnd).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Error Message */}
          {error && (
            <div style={styles.error}>
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div style={styles.success}>
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div style={styles.loading}>
              <div style={styles.loadingSpinner}>⏳</div>
              <p>Loading your objectives...</p>
            </div>
          ) : objectives.length === 0 ? (
            /* Empty State */
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📋</div>
              <h3 style={styles.emptyTitle}>No Objectives Found</h3>
              <p style={styles.emptyText}>
                You don't have any objectives to report on.<br />
                Please create objectives first in the Objectives page.
              </p>
            </div>
          ) : (
            <>
              {/* Progress Summary */}
              <div style={styles.progressSummary}>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryValue}>
                    {submittedCount}/{totalObjectives}
                  </div>
                  <div style={styles.summaryLabel}>Reports Submitted</div>
                </div>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryValue}>{completionPercentage}%</div>
                  <div style={styles.summaryLabel}>Complete</div>
                </div>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryValue}>
                    {totalObjectives - submittedCount}
                  </div>
                  <div style={styles.summaryLabel}>Remaining</div>
                </div>
              </div>

              {/* Objectives List */}
              <div style={styles.objectivesList}>
                {objectives.map((obj) => {
                  const objectiveId = obj.objective._id;
                  const data = formData[objectiveId] || {
                    progress: 0,
                    comments: '',
                    attachments: [],
                    reportId: null,
                  };
                  const isExpanded = expandedId === objectiveId;
                  const isUploading = uploading[objectiveId];
                  const isSubmitting = submitting[objectiveId];

                  return (
                    <div key={objectiveId} style={styles.objectiveCard}>
                      {/* Objective Header (Clickable) */}
                      <div
                        style={styles.objectiveHeader}
                        onClick={() => toggleExpand(objectiveId)}
                      >
                        <div style={styles.objectiveHeaderLeft}>
                          <h3 style={styles.objectiveTitle}>
                            {obj.objective.title}
                          </h3>
                          {obj.objective.description && (
                            <p style={styles.objectiveDescription}>
                              {obj.objective.description}
                            </p>
                          )}
                        </div>

                        <div style={styles.objectiveMeta}>
                          <span style={styles.weightBadge}>
                            Weight: {obj.objective.value}
                          </span>
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...(obj.isSubmitted
                                ? styles.statusSubmitted
                                : styles.statusPending),
                            }}
                          >
                            {obj.isSubmitted ? '✓ Submitted' : '○ Pending'}
                          </span>
                          <span
                            style={{
                              ...styles.expandIcon,
                              transform: isExpanded
                                ? 'rotate(180deg)'
                                : 'rotate(0deg)',
                            }}
                          >
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* Objective Body (Expandable) */}
                      {isExpanded && (
                        <div style={styles.objectiveBody}>
                          {/* Progress Slider */}
                          <div style={styles.field}>
                            <label style={styles.label}>
                              Progress Achieved *
                            </label>
                            <div style={styles.progressContainer}>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={data.progress}
                                onChange={(e) =>
                                  updateFormData(
                                    objectiveId,
                                    'progress',
                                    parseInt(e.target.value)
                                  )
                                }
                                style={{
                                  ...styles.progressSlider,
                                  '--progress': `${data.progress}%`,
                                }}
                              />
                              <span style={styles.progressValue}>
                                {data.progress}%
                              </span>
                            </div>
                          </div>

                          {/* Comments */}
                          <div style={styles.field}>
                            <label style={styles.label}>
                              Comments / Notes
                            </label>
                            <textarea
                              style={styles.textarea}
                              value={data.comments}
                              onChange={(e) =>
                                updateFormData(
                                  objectiveId,
                                  'comments',
                                  e.target.value
                                )
                              }
                              placeholder="Describe your progress, achievements, challenges faced, lessons learned..."
                              maxLength={2000}
                            />
                          </div>

                          {/* File Upload */}
                          <div style={styles.field}>
                            <label style={styles.label}>
                              Attachments / Evidence
                            </label>

                            {/* Existing Attachments */}
                            {data.attachments && data.attachments.length > 0 && (
                              <div style={styles.attachmentsList}>
                                {data.attachments.map((attachment) => (
                                  <div
                                    key={attachment._id}
                                    style={styles.attachmentItem}
                                  >
                                    <div style={styles.attachmentInfo}>
                                      <span style={styles.attachmentIcon}>
                                        {getFileIcon(attachment.mimetype)}
                                      </span>
                                      <div style={styles.attachmentDetails}>
                                        <div style={styles.attachmentName}>
                                          {attachment.originalName}
                                        </div>
                                        <div style={styles.attachmentSize}>
                                          {formatFileSize(attachment.size)}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={styles.attachmentActions}>
                                      <a
                                        href={getDownloadUrl(
                                          data.reportId,
                                          attachment._id
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          ...styles.smallBtn,
                                          ...styles.downloadBtn,
                                        }}
                                      >
                                        Download
                                      </a>
                                      <button
                                        style={{
                                          ...styles.smallBtn,
                                          ...styles.deleteBtn,
                                        }}
                                        onClick={() =>
                                          handleDeleteAttachment(
                                            objectiveId,
                                            attachment._id
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Upload Area */}
                            <div style={styles.fileUploadContainer}>
                              <div
                                style={{
                                  ...styles.fileUpload,
                                  ...(data.reportId
                                    ? {}
                                    : styles.fileUploadDisabled),
                                }}
                                onClick={() => {
                                  if (data.reportId && !isUploading) {
                                    fileInputRefs.current[objectiveId]?.click();
                                  }
                                }}
                              >
                                <input
                                  type="file"
                                  multiple
                                  ref={(el) =>
                                    (fileInputRefs.current[objectiveId] = el)
                                  }
                                  style={{ display: 'none' }}
                                  onChange={(e) =>
                                    handleFileSelect(objectiveId, e.target.files)
                                  }
                                  disabled={!data.reportId || isUploading}
                                />
                                <div style={styles.fileUploadIcon}>
                                  {isUploading ? '⏳' : '📁'}
                                </div>
                                <div style={styles.fileUploadText}>
                                  {isUploading
                                    ? 'Uploading files...'
                                    : data.reportId
                                    ? 'Click or drag files here to upload'
                                    : 'Save report first to enable file upload'}
                                </div>
                                <div style={styles.fileUploadSubtext}>
                                  Max 25MB per file • All file types accepted
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={styles.objectiveActions}>
                            <button
                              style={{
                                ...(obj.isSubmitted
                                  ? styles.btnPrimary
                                  : styles.btnSuccess),
                                ...(isSubmitting ? styles.btnDisabled : {}),
                              }}
                              onClick={() => handleSubmitReport(objectiveId)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting
                                ? '⏳ Saving...'
                                : obj.isSubmitted
                                ? '💾 Update Report'
                                : '✅ Submit Report'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}