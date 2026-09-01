import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Plus, Upload, Download, Save, Trash2, 
  RefreshCw, AlertCircle, CheckCircle, Lock, Shield, 
  FileSpreadsheet, Calculator, PlusCircle, MinusCircle, FileText, X
} from 'lucide-react';
import { workspaceServices } from '../services/workspaceServices';

const DEFAULT_COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const DEFAULT_ROWS = [
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
];

export default function SpreadsheetsTab({ workspace, userRole = 'MEMBER', currentUser }) {
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const [sheetName, setSheetName] = useState('Untitled Spreadsheet');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [data, setData] = useState(DEFAULT_ROWS);
  const [selectedColIndex, setSelectedColIndex] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const isViewer = userRole === 'VIEWER';

  // Find active sheet object if loaded
  const activeSheetObj = spreadsheets.find(s => s.id === activeSheetId) || null;

  // Permission helpers
  const canEditSheet = (sheetObj) => {
    if (isViewer) return false;
    if (!sheetObj) return !isViewer; // brand new sheet
    if (userRole === 'OWNER') return true;

    const creatorRole = sheetObj.creator_role || (sheetObj.creator ? 'MEMBER' : 'OWNER');
    const creatorUsername = sheetObj.creator?.username;
    const currentUsername = currentUser?.username;

    if (userRole === 'ADMIN') {
      return creatorRole !== 'OWNER';
    }

    if (userRole === 'MEMBER') {
      if (!sheetObj.creator) return false;
      if (creatorRole === 'OWNER' || creatorRole === 'ADMIN') return false;
      return creatorUsername === currentUsername || sheetObj.creator?.id === currentUser?.user_id;
    }

    return false;
  };

  const canDeleteSheet = (sheetObj) => {
    if (isViewer || !sheetObj) return false;
    if (userRole === 'OWNER') return true;

    const creatorRole = sheetObj.creator_role || (sheetObj.creator ? 'MEMBER' : 'OWNER');
    const creatorUsername = sheetObj.creator?.username;
    const currentUsername = currentUser?.username;

    if (userRole === 'ADMIN') {
      return creatorRole !== 'OWNER';
    }

    if (userRole === 'MEMBER') {
      if (!sheetObj.creator) return false;
      if (creatorRole === 'OWNER' || creatorRole === 'ADMIN') return false;
      return creatorUsername === currentUsername || sheetObj.creator?.id === currentUser?.user_id;
    }

    return false;
  };

  const isCurrentEditable = canEditSheet(activeSheetObj);
  const isCurrentDeletable = canDeleteSheet(activeSheetObj);

  // Fetch spreadsheets from workspace context items
  const fetchSpreadsheets = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await workspaceServices.listContext(workspace.id);
      const allFiles = res.data || [];
      const sheetFiles = allFiles.filter(f => {
        const name = (f.original_filename || f.name || '').toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.tsv') || f.mime_type === 'text/csv';
      });
      setSpreadsheets(sheetFiles);
    } catch (err) {
      console.error(err);
      setError('Failed to load workspace spreadsheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpreadsheets();
  }, [workspace?.id]);

  // Load a saved spreadsheet into the active grid
  const loadSpreadsheet = (sheetFile) => {
    try {
      const content = sheetFile.normalized_content || '';
      const lines = content.split('\n').filter(line => line.trim() !== '');
      if (lines.length > 0) {
        // Parse CSV/TSV
        const isMarkdownTable = lines[0].includes('|');
        let parsedRows = [];
        
        if (isMarkdownTable) {
          // Parse Markdown table format
          parsedRows = lines
            .filter(line => !line.includes('---'))
            .map(line => line.split('|').slice(1, -1).map(c => c.trim()));
        } else {
          // Parse CSV or TSV
          const delim = sheetFile.original_filename?.endsWith('.tsv') || content.includes('\t') ? '\t' : ',';
          parsedRows = lines.map(line => line.split(delim).map(c => c.trim().replace(/^["']|["']$/g, '')));
        }

        if (parsedRows.length > 0) {
          const header = parsedRows[0];
          const rows = parsedRows.slice(1);
          setColumns(header.length > 0 ? header : DEFAULT_COLUMNS);
          setData(rows.length > 0 ? rows : DEFAULT_ROWS);
          setSheetName(sheetFile.original_filename || sheetFile.name || 'Spreadsheet');
          setActiveSheetId(sheetFile.id);
          setSuccessMsg(`Loaded "${sheetFile.original_filename || sheetFile.name}"`);
          setTimeout(() => setSuccessMsg(''), 3000);
          return;
        }
      }
    } catch (err) {
      console.error('Error parsing sheet content:', err);
      setError('Failed to parse spreadsheet content.');
    }
  };

  // Reset to blank sheet
  const handleNewSheet = () => {
    if (isViewer) return;
    setActiveSheetId(null);
    setSheetName('Untitled Spreadsheet');
    setColumns(['Item', 'Category', 'Quantity', 'Unit Price', 'Total']);
    setData([
      ['Server Node A', 'Hardware', '4', '250', '1000'],
      ['Network Switch', 'Networking', '2', '120', '240'],
      ['Backup Drive', 'Storage', '10', '80', '800'],
      ['', '', '', '', ''],
    ]);
    setError('');
    setSuccessMsg('Created new spreadsheet template');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Handle cell edit
  const handleCellChange = (rowIndex, colIndex, value) => {
    if (!isCurrentEditable) return;
    const newData = [...data];
    if (!newData[rowIndex]) {
      newData[rowIndex] = new Array(columns.length).fill('');
    }
    newData[rowIndex][colIndex] = value;
    setData(newData);
  };

  // Handle column header edit
  const handleHeaderChange = (colIndex, value) => {
    if (!isCurrentEditable) return;
    const newCols = [...columns];
    newCols[colIndex] = value;
    setColumns(newCols);
  };

  // Add row
  const handleAddRow = () => {
    if (!isCurrentEditable) return;
    setData([...data, new Array(columns.length).fill('')]);
  };

  // Remove row
  const handleRemoveRow = (rowIndex) => {
    if (!isCurrentEditable || data.length <= 1) return;
    setData(data.filter((_, idx) => idx !== rowIndex));
  };

  // Add column
  const handleAddColumn = () => {
    if (!isCurrentEditable) return;
    const nextColName = String.fromCharCode(65 + (columns.length % 26)) + (columns.length >= 26 ? Math.floor(columns.length / 26) : '');
    setColumns([...columns, nextColName]);
    setData(data.map(row => [...row, '']));
  };

  // Remove column
  const handleRemoveColumn = (colIndex) => {
    if (!isCurrentEditable || columns.length <= 1) return;
    setColumns(columns.filter((_, idx) => idx !== colIndex));
    setData(data.map(row => row.filter((_, idx) => idx !== colIndex)));
  };

  // Delete saved spreadsheet
  const handleDeleteSheet = async (e, sheetObj) => {
    e.stopPropagation();
    if (!canDeleteSheet(sheetObj)) return;
    if (!window.confirm(`Are you sure you want to delete "${sheetObj.original_filename || sheetObj.name}"?`)) return;

    try {
      await workspaceServices.removeContext(workspace.id, sheetObj.id);
      setSuccessMsg(`Deleted "${sheetObj.original_filename || sheetObj.name}"`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (activeSheetId === sheetObj.id) {
        handleNewSheet();
      }
      fetchSpreadsheets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to delete spreadsheet.');
    }
  };

  // Export current grid as CSV string
  const generateCSVString = () => {
    const headerRow = columns.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',');
    const bodyRows = data.map(row => 
      columns.map((_, colIdx) => `"${(row[colIdx] || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    return `${headerRow}\n${bodyRows}`;
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const csvContent = generateCSVString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = sheetName.endsWith('.csv') ? sheetName : `${sheetName}.csv`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save current grid to workspace context/shared files
  const handleSaveToWorkspace = async () => {
    if (!isCurrentEditable || !workspace?.id) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const csvContent = generateCSVString();
      const fileName = sheetName.endsWith('.csv') ? sheetName : `${sheetName}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const fileObj = new File([blob], fileName, { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', fileObj);
      formData.append('name', fileName);
      formData.append('context_type', 'REFERENCE');

      // If activeSheetId exists, remove the previous version first
      if (activeSheetId) {
        try {
          await workspaceServices.removeContext(workspace.id, activeSheetId);
        } catch (e) {
          // ignore
        }
      }

      const res = await workspaceServices.addContext(workspace.id, formData, true);
      setActiveSheetId(res.data.id);
      setSuccessMsg(`Saved "${fileName}" to workspace files!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchSpreadsheets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save spreadsheet to workspace.');
    } finally {
      setSaving(false);
    }
  };

  // Upload/import CSV file into grid
  const handleImportFile = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result;
        if (typeof content === 'string') {
          const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length > 0) {
            const delim = file.name.endsWith('.tsv') ? '\t' : ',';
            const parsed = lines.map(line => line.split(delim).map(c => c.trim().replace(/^["']|["']$/g, '')));
            setColumns(parsed[0] || DEFAULT_COLUMNS);
            setData(parsed.slice(1).length > 0 ? parsed.slice(1) : DEFAULT_ROWS);
            setSheetName(file.name.replace(/\.[^/.]+$/, ''));
            setActiveSheetId(null);
            setSuccessMsg(`Imported "${file.name}"`);
            setTimeout(() => setSuccessMsg(''), 3000);
          }
        }
      };
      reader.readAsText(file);
    }
    e.target.value = null;
  };

  // Compute live column statistics (SUM, AVG, MIN, MAX)
  const computeColumnStats = () => {
    let numbers = [];
    if (selectedColIndex !== null && selectedColIndex < columns.length) {
      numbers = data
        .map(row => parseFloat(row[selectedColIndex]))
        .filter(n => !isNaN(n));
    } else {
      // All numbers in grid
      data.forEach(row => {
        row.forEach(cell => {
          const n = parseFloat(cell);
          if (!isNaN(n)) numbers.push(n);
        });
      });
    }

    if (numbers.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }

    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = sum / numbers.length;
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);

    return {
      count: numbers.length,
      sum: sum % 1 === 0 ? sum : sum.toFixed(2),
      avg: avg.toFixed(2),
      min: min % 1 === 0 ? min : min.toFixed(2),
      max: max % 1 === 0 ? max : max.toFixed(2)
    };
  };

  const stats = computeColumnStats();

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Spreadsheets & Tabular Data Hub</h1>
          <p style={styles.subtitle}>
            Create, edit, analyze, and manage tabular spreadsheets and dataset files with team collaboration.
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

      {/* Action Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.sheetNameWrapper}>
          <FileSpreadsheet size={18} style={{ color: '#22c55e', marginRight: '8px' }} />
          <input 
            type="text"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            disabled={!isCurrentEditable}
            style={{
              ...styles.sheetNameInput,
              opacity: !isCurrentEditable ? 0.7 : 1,
              cursor: !isCurrentEditable ? 'not-allowed' : 'text'
            }}
            placeholder="Spreadsheet Name"
          />
        </div>

        <div style={styles.toolbarActions}>
          <button 
            onClick={handleNewSheet}
            disabled={isViewer}
            style={{
              ...styles.toolBtn,
              opacity: isViewer ? 0.5 : 1,
              cursor: isViewer ? 'not-allowed' : 'pointer'
            }}
            title={isViewer ? "Viewers cannot create new sheets" : "Create template"}
          >
            <Plus size={14} style={{ marginRight: '4px' }} />
            New Sheet
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isViewer}
            style={{
              ...styles.toolBtn,
              opacity: isViewer ? 0.5 : 1,
              cursor: isViewer ? 'not-allowed' : 'pointer'
            }}
            title={isViewer ? "Viewers cannot upload files" : "Import CSV/TSV"}
          >
            <Upload size={14} style={{ marginRight: '4px' }} />
            Import CSV
          </button>
          <input 
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button 
            onClick={handleDownloadCSV}
            style={styles.toolBtn}
            title="Download as CSV file"
          >
            <Download size={14} style={{ marginRight: '4px' }} />
            Export CSV
          </button>

          {isCurrentEditable && (
            <button 
              onClick={handleSaveToWorkspace}
              disabled={saving}
              style={styles.btnSave}
              title="Save spreadsheet directly into workspace files"
            >
              <Save size={14} style={{ marginRight: '6px' }} />
              {saving ? 'Saving...' : 'Save to Workspace'}
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout (Sidebar of Saved Sheets + Interactive Grid) */}
      <div style={styles.workspaceLayout}>
        {/* Saved Sheets Left Column */}
        <aside style={styles.sheetsSidebar}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>Workspace Sheets ({spreadsheets.length})</span>
            <button onClick={fetchSpreadsheets} style={styles.iconBtn} title="Refresh sheets">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div style={styles.savedSheetsList}>
            {spreadsheets.length === 0 ? (
              <div style={styles.noSheetsBox}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  No spreadsheets stored in workspace yet. Save this sheet or upload a CSV.
                </p>
              </div>
            ) : (
              spreadsheets.map(sheet => {
                const isSelected = activeSheetId === sheet.id;
                const role = sheet.creator_role || (sheet.creator ? 'MEMBER' : 'OWNER');
                const username = sheet.creator?.username || (role === 'OWNER' ? 'Owner' : 'Member');
                const isProtected = !canEditSheet(sheet);
                const isDeletable = canDeleteSheet(sheet);

                return (
                  <div 
                    key={sheet.id}
                    onClick={() => loadSpreadsheet(sheet)}
                    style={{
                      ...styles.savedSheetItem,
                      border: isSelected ? '1px solid var(--text-primary)' : '1px solid var(--border-medium)',
                      background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                        <Table size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                        <span style={styles.sheetItemName} title={sheet.original_filename || sheet.name}>
                          {sheet.original_filename || sheet.name}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '9px',
                          fontWeight: '600',
                          background: role === 'OWNER' ? 'rgba(168, 85, 247, 0.12)' : role === 'ADMIN' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                          color: role === 'OWNER' ? '#c084fc' : role === 'ADMIN' ? '#60a5fa' : '#4ade80',
                          border: `1px solid ${role === 'OWNER' ? 'rgba(168, 85, 247, 0.25)' : role === 'ADMIN' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                          whiteSpace: 'nowrap'
                        }} title={`Created by ${role}: ${username}`}>
                          {isProtected ? '🔒' : (role === 'OWNER' ? '👑' : role === 'ADMIN' ? '🛡️' : '👤')} {username}
                        </span>

                        {isDeletable && (
                          <button
                            onClick={(e) => handleDeleteSheet(e, sheet)}
                            style={styles.sheetDeleteBtn}
                            title="Delete Spreadsheet"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Grid Editor Area */}
        <main style={styles.gridContainer}>
          {/* Table Controls (Add Col / Row) */}
          <div style={styles.gridControls}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleAddRow}
                disabled={!isCurrentEditable}
                style={{
                  ...styles.gridControlBtn,
                  opacity: !isCurrentEditable ? 0.5 : 1,
                  cursor: !isCurrentEditable ? 'not-allowed' : 'pointer'
                }}
              >
                <PlusCircle size={13} style={{ marginRight: '4px' }} />
                Add Row
              </button>
              <button 
                onClick={handleAddColumn}
                disabled={!isCurrentEditable}
                style={{
                  ...styles.gridControlBtn,
                  opacity: !isCurrentEditable ? 0.5 : 1,
                  cursor: !isCurrentEditable ? 'not-allowed' : 'pointer'
                }}
              >
                <PlusCircle size={13} style={{ marginRight: '4px' }} />
                Add Column
              </button>
            </div>

            {!isCurrentEditable && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px'
              }}>
                <Lock size={12} style={{ marginRight: '5px', color: '#f59e0b', flexShrink: 0 }} />
                <span>
                  <strong>Protected Sheet:</strong> {activeSheetObj ? `Authored by ${activeSheetObj.creator_role === 'OWNER' ? '👑 Workspace Owner' : `${activeSheetObj.creator_role} (${activeSheetObj.creator?.username})`}. Read-only.` : 'Read-only mode.'}
                </span>
              </div>
            )}
          </div>

          {/* Data Grid Table */}
          <div style={styles.tableScrollBox}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.rowNumberTh}>#</th>
                  {columns.map((col, colIdx) => (
                    <th 
                      key={colIdx} 
                      onClick={() => setSelectedColIndex(selectedColIndex === colIdx ? null : colIdx)}
                      style={{
                        ...styles.th,
                        background: selectedColIndex === colIdx ? 'var(--bg-hover)' : 'var(--bg-card)'
                      }}
                    >
                      <div style={styles.thContent}>
                        <input 
                          type="text"
                          value={col}
                          onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                          disabled={!isCurrentEditable}
                          style={styles.thInput}
                        />
                        {isCurrentEditable && columns.length > 1 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveColumn(colIdx);
                            }}
                            style={styles.colDeleteBtn}
                            title="Delete Column"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={styles.actionTh}></th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} style={styles.tr}>
                    <td style={styles.rowNumberTd}>{rowIdx + 1}</td>
                    {columns.map((_, colIdx) => (
                      <td key={colIdx} style={styles.td}>
                        <input 
                          type="text"
                          value={row[colIdx] || ''}
                          onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                          disabled={!isCurrentEditable}
                          style={{
                            ...styles.cellInput,
                            background: selectedColIndex === colIdx ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                            cursor: !isCurrentEditable ? 'default' : 'text'
                          }}
                        />
                      </td>
                    ))}
                    <td style={styles.actionTd}>
                      {isCurrentEditable && data.length > 1 && (
                        <button 
                          onClick={() => handleRemoveRow(rowIdx)}
                          style={styles.rowDeleteBtn}
                          title="Delete Row"
                        >
                          <MinusCircle size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formula & Live Metric Summary Bar */}
          <div style={styles.formulaBar}>
            <div style={styles.formulaLeft}>
              <Calculator size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {selectedColIndex !== null 
                  ? `Selected Column [${columns[selectedColIndex]}]:` 
                  : 'Overall Grid Metrics:'}
              </span>
            </div>
            
            <div style={styles.formulaStats}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Rows:</span>
                <span style={styles.statValue}>{data.length}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Columns:</span>
                <span style={styles.statValue}>{columns.length}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Numeric Cells:</span>
                <span style={styles.statValue}>{stats.count}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Sum:</span>
                <span style={{ ...styles.statValue, color: 'var(--status-success, #22c55e)' }}>{stats.sum}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Avg:</span>
                <span style={styles.statValue}>{stats.avg}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Min:</span>
                <span style={styles.statValue}>{stats.min}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Max:</span>
                <span style={styles.statValue}>{stats.max}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px',
    maxWidth: '1360px',
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  sheetNameWrapper: {
    display: 'flex',
    alignItems: 'center'
  },
  sheetNameInput: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px dashed var(--border-medium)',
    outline: 'none',
    padding: '4px 8px',
    minWidth: '220px'
  },
  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  toolBtn: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'var(--transition-all)'
  },
  btnSave: {
    background: 'var(--text-primary)',
    color: 'var(--bg-app-solid)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  workspaceLayout: {
    display: 'flex',
    gap: '16px',
    minHeight: '520px',
    flexWrap: 'wrap'
  },
  sheetsSidebar: {
    width: '240px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-light)'
  },
  sidebarTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0
  },
  savedSheetsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    overflowY: 'auto',
    flex: 1
  },
  noSheetsBox: {
    padding: '20px 10px',
    textAlign: 'center'
  },
  savedSheetItem: {
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition-all)'
  },
  sheetItemName: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  gridContainer: {
    flex: 1,
    minWidth: '600px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  gridControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border-medium)',
    background: 'var(--bg-hover)'
  },
  gridControlBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 10px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer'
  },
  viewerBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  tableScrollBox: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '440px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px'
  },
  th: {
    borderRight: '1px solid var(--border-medium)',
    borderBottom: '1px solid var(--border-medium)',
    padding: '6px 8px',
    textAlign: 'left',
    minWidth: '130px',
    background: 'var(--bg-card)'
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  thInput: {
    border: 'none',
    background: 'transparent',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%'
  },
  colDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 2px'
  },
  rowNumberTh: {
    width: '36px',
    textAlign: 'center',
    borderRight: '1px solid var(--border-medium)',
    borderBottom: '1px solid var(--border-medium)',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    fontSize: '11px'
  },
  actionTh: {
    width: '32px',
    borderBottom: '1px solid var(--border-medium)'
  },
  tr: {
    borderBottom: '1px solid var(--border-light)'
  },
  rowNumberTd: {
    textAlign: 'center',
    borderRight: '1px solid var(--border-medium)',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    userSelect: 'none'
  },
  td: {
    borderRight: '1px solid var(--border-light)',
    padding: 0
  },
  cellInput: {
    width: '100%',
    border: 'none',
    padding: '8px 10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box'
  },
  actionTd: {
    textAlign: 'center',
    padding: '0 4px'
  },
  sheetDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-all)',
    opacity: 0.7
  },
  rowDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px'
  },
  formulaBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderTop: '1px solid var(--border-medium)',
    background: 'var(--bg-hover)',
    flexWrap: 'wrap',
    gap: '10px'
  },
  formulaLeft: {
    display: 'flex',
    alignItems: 'center'
  },
  formulaStats: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px'
  },
  statLabel: {
    color: 'var(--text-muted)'
  },
  statValue: {
    fontWeight: '600',
    color: 'var(--text-primary)'
  }
};
