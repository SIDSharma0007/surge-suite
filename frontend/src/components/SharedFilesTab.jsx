import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, UploadCloud, FileText, Table, Code, File, 
  Search, Eye, Trash2, Download, AlertCircle, CheckCircle, 
  Lock, X, RefreshCw, Shield
} from 'lucide-react';
import { workspaceServices } from '../services/workspaceServices';

export default function SharedFilesTab({ workspace, userRole = 'MEMBER' }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Preview Modal
  const [previewFile, setPreviewFile] = useState(null);

  const isViewer = userRole === 'VIEWER';

  const fetchFiles = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await workspaceServices.listContext(workspace.id);
      setFiles(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load workspace files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [workspace?.id]);

  const handleUploadFile = async (fileObj) => {
    if (!fileObj || isViewer) return;
    setIsUploading(true);
    setError('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', fileObj);
    formData.append('name', fileObj.name);
    formData.append('context_type', 'REFERENCE');

    try {
      await workspaceServices.addContext(workspace.id, formData, true);
      setSuccessMsg(`Successfully uploaded "${fileObj.name}"`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchFiles();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
    e.target.value = null;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!isViewer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (isViewer) return;
    if (!window.confirm(`Are you sure you want to remove "${fileName}" from shared workspace files?`)) {
      return;
    }

    try {
      await workspaceServices.removeContext(workspace.id, fileId);
      setSuccessMsg(`Removed "${fileName}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (previewFile?.id === fileId) {
        setPreviewFile(null);
      }
      fetchFiles();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to delete file.');
    }
  };

  const handleDownloadFile = (fileItem) => {
    const textContent = fileItem.normalized_content || '';
    const blob = new Blob([textContent], { type: fileItem.mime_type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.original_filename || fileItem.name || 'download.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileCategory = (item) => {
    const ext = (item.original_filename || item.name || '').toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.tsv')) return 'SPREADSHEET';
    if (ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc')) return 'DOCUMENT';
    if (ext.endsWith('.json') || ext.endsWith('.html') || ext.endsWith('.htm') || ext.endsWith('.js') || ext.endsWith('.py')) return 'CODE';
    return 'TEXT';
  };

  const getFileIcon = (item) => {
    const cat = getFileCategory(item);
    if (cat === 'SPREADSHEET') return <Table size={18} style={{ color: '#22c55e' }} />;
    if (cat === 'DOCUMENT') return <FileText size={18} style={{ color: '#3b82f6' }} />;
    if (cat === 'CODE') return <Code size={18} style={{ color: '#f59e0b' }} />;
    return <File size={18} style={{ color: 'var(--text-secondary)' }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => {
    const nameMatch = (f.name || f.original_filename || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!nameMatch) return false;
    if (selectedCategory === 'ALL') return true;
    return getFileCategory(f) === selectedCategory;
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Shared Files & Workspace Documents</h1>
          <p style={styles.subtitle}>
            Upload and access shared knowledge, reference documents, and tabular data available to all workspace members.
          </p>
        </div>
        <div style={styles.headerBadge}>
          <Shield size={14} style={{ marginRight: '6px', color: 'var(--text-muted)' }} />
          <span>Role: <strong style={{ color: 'var(--text-primary)' }}>{userRole}</strong></span>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={15} style={{ marginRight: '8px', flexShrink: 0 }} />
          {error}
        </div>
      )}
      {successMsg && (
        <div style={styles.successAlert}>
          <CheckCircle size={15} style={{ marginRight: '8px', flexShrink: 0 }} />
          {successMsg}
        </div>
      )}

      {/* Upload Box (Active for Owner/Admin/Member; Disabled for Viewer) */}
      <section style={styles.uploadSection}>
        <div 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            ...styles.dropZone,
            borderColor: dragActive ? 'var(--text-primary)' : 'var(--border-medium)',
            background: dragActive ? 'var(--bg-hover)' : 'var(--bg-card)',
            opacity: isViewer ? 0.7 : 1,
            cursor: isViewer ? 'not-allowed' : 'pointer'
          }}
          onClick={() => {
            if (!isViewer && !isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <input 
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            accept=".pdf,.docx,.doc,.csv,.tsv,.txt,.md,.markdown,.json,.html,.htm"
            style={{ display: 'none' }}
            disabled={isViewer || isUploading}
          />
          
          <div style={styles.dropZoneContent}>
            {isViewer ? (
              <>
                <Lock size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                <h4 style={styles.dropZoneTitle}>Upload Disabled (Read-Only Access)</h4>
                <p style={styles.dropZoneText}>Viewers can inspect and download shared documents, but cannot upload new files.</p>
              </>
            ) : (
              <>
                <UploadCloud size={32} style={{ color: isUploading ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: '10px' }} />
                <h4 style={styles.dropZoneTitle}>
                  {isUploading ? 'Uploading & Normalizing...' : 'Drag & drop files here, or click to browse'}
                </h4>
                <p style={styles.dropZoneText}>
                  Supports PDF, DOCX, CSV, TSV, TXT, Markdown, JSON, HTML (Max 10 MB).
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Search & Category Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchBox}>
          <Search size={14} style={{ color: 'var(--text-muted)', marginLeft: '10px' }} />
          <input 
            type="text"
            placeholder="Search shared files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={styles.categoryPills}>
          {[
            { id: 'ALL', label: 'All Files' },
            { id: 'DOCUMENT', label: 'Documents (PDF/DOCX)' },
            { id: 'SPREADSHEET', label: 'Spreadsheets (CSV/TSV)' },
            { id: 'TEXT', label: 'Notes (TXT/MD)' },
            { id: 'CODE', label: 'Code & JSON' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                ...styles.pillBtn,
                background: selectedCategory === cat.id ? 'var(--text-primary)' : 'var(--bg-card)',
                color: selectedCategory === cat.id ? 'var(--bg-app-solid)' : 'var(--text-secondary)',
                fontWeight: selectedCategory === cat.id ? '600' : '500',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button onClick={fetchFiles} style={styles.refreshBtn} title="Refresh file list">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* File List Grid */}
      <section style={styles.fileGridSection}>
        {loading && files.length === 0 ? (
          <div style={styles.emptyState}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Loading shared files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={styles.emptyState}>
            <FolderOpen size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3 style={styles.emptyTitle}>No shared files found</h3>
            <p style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'ALL' 
                ? 'No files matched your search or category filter.' 
                : 'No documents have been uploaded to this workspace yet.'}
            </p>
          </div>
        ) : (
          <div style={styles.fileGrid}>
            {filteredFiles.map(fileItem => {
              const displayName = fileItem.original_filename || fileItem.name;
              const formattedDate = new Date(fileItem.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div key={fileItem.id} style={styles.fileCard}>
                  <div style={styles.fileCardHeader}>
                    <div style={styles.fileIconWrapper}>
                      {getFileIcon(fileItem)}
                    </div>
                    <div style={styles.fileInfo}>
                      <h4 style={styles.fileName} title={displayName}>{displayName}</h4>
                      <span style={styles.fileMeta}>
                        {formatFileSize(fileItem.file_size)} • {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div style={styles.fileSnippet}>
                    {fileItem.normalized_content ? (
                      fileItem.normalized_content.substring(0, 140) + (fileItem.normalized_content.length > 140 ? '...' : '')
                    ) : (
                      <em style={{ color: 'var(--text-muted)' }}>No preview available</em>
                    )}
                  </div>

                  <div style={styles.fileCardFooter}>
                    <button 
                      onClick={() => setPreviewFile(fileItem)}
                      style={styles.cardActionBtn}
                      title="Preview text & metadata"
                    >
                      <Eye size={13} style={{ marginRight: '4px' }} />
                      Preview
                    </button>
                    
                    <button 
                      onClick={() => handleDownloadFile(fileItem)}
                      style={styles.cardActionBtn}
                      title="Download document text"
                    >
                      <Download size={13} style={{ marginRight: '4px' }} />
                      Download
                    </button>

                    {!isViewer && (
                      <button 
                        onClick={() => handleDeleteFile(fileItem.id, displayName)}
                        style={{ ...styles.cardActionBtn, color: 'var(--status-error, #ef4444)' }}
                        title="Delete from workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Preview Modal */}
      {previewFile && (
        <div style={styles.modalBackdrop} onClick={() => setPreviewFile(null)}>
          <div style={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getFileIcon(previewFile)}
                <h3 style={styles.modalTitle}>{previewFile.original_filename || previewFile.name}</h3>
              </div>
              <button onClick={() => setPreviewFile(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Meta stats bar */}
              <div style={styles.metaRow}>
                <div style={styles.metaBadge}>
                  Size: <strong>{formatFileSize(previewFile.file_size)}</strong>
                </div>
                <div style={styles.metaBadge}>
                  Lines: <strong>{previewFile.metadata?.line_count || previewFile.normalized_content?.split('\n').length || 1}</strong>
                </div>
                <div style={styles.metaBadge}>
                  Chars: <strong>{previewFile.metadata?.char_count || previewFile.normalized_content?.length || 0}</strong>
                </div>
                {previewFile.content_hash && (
                  <div style={{ ...styles.metaBadge, fontFamily: 'monospace', fontSize: '11px' }}>
                    SHA256: {previewFile.content_hash.substring(0, 12)}...
                  </div>
                )}
              </div>

              <div style={styles.previewContentBox}>
                <pre style={styles.previewPre}>
                  {previewFile.normalized_content || 'No text extracted.'}
                </pre>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button 
                onClick={() => handleDownloadFile(previewFile)}
                style={styles.btnPrimary}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                Download Content
              </button>
              <button 
                onClick={() => setPreviewFile(null)}
                style={styles.btnSecondary}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 6px 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    maxWidth: '650px',
    lineHeight: '1.4'
  },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-full)',
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--status-error, #ef4444)',
    fontSize: '13px',
    marginBottom: '16px'
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--status-success, #22c55e)',
    fontSize: '13px',
    marginBottom: '16px'
  },
  uploadSection: {
    marginBottom: '24px'
  },
  dropZone: {
    border: '2px dashed var(--border-medium)',
    borderRadius: 'var(--radius-lg)',
    padding: '30px 20px',
    textAlign: 'center',
    transition: 'var(--transition-all)',
    background: 'var(--bg-card)'
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropZoneTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 6px 0'
  },
  dropZoneText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-input, var(--bg-card))',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    width: '260px'
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    padding: '8px 10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%'
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0 8px'
  },
  categoryPills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    flex: 1
  },
  pillBtn: {
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-full)',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'var(--transition-all)'
  },
  refreshBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-secondary)',
    padding: '8px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  fileGridSection: {
    minHeight: '260px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-muted)'
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0'
  },
  emptyText: {
    fontSize: '13px',
    margin: 0
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px'
  },
  fileCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)'
  },
  fileCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px'
  },
  fileIconWrapper: {
    padding: '8px',
    background: 'var(--bg-hover)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileInfo: {
    flex: 1,
    minWidth: 0
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 3px 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileMeta: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  fileSnippet: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    marginBottom: '16px',
    padding: '8px 10px',
    background: 'var(--bg-hover)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    height: '56px',
    overflow: 'hidden',
    wordBreak: 'break-all'
  },
  fileCardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    borderTop: '1px solid var(--border-light)',
    paddingTop: '10px'
  },
  cardActionBtn: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalDialog: {
    background: 'var(--bg-app-solid)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-xl)'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-medium)'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },
  metaBadge: {
    padding: '4px 10px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  previewContentBox: {
    background: 'var(--bg-input, var(--bg-card))',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  previewPre: {
    margin: 0,
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: '1.5'
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px',
    borderTop: '1px solid var(--border-medium)'
  },
  btnPrimary: {
    background: 'var(--text-primary)',
    color: 'var(--bg-app-solid)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  btnSecondary: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
