import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

const NEEDED = [
  { key: 'LCC',  label: 'l-cc.dcm',  api: 'l_cc',  display: 'Left CC' },
  { key: 'LMLO', label: 'l-mlo.dcm', api: 'l_mlo', display: 'Left MLO' },
  { key: 'RCC',  label: 'r-cc.dcm',  api: 'r_cc',  display: 'Right CC' },
  { key: 'RMLO', label: 'r-mlo.dcm', api: 'r_mlo', display: 'Right MLO' },
];

/* ── SVG icons (matching HTML template) ── */
const CheckBadgeSVG = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 4L6 11L3 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LocalFolderSVG = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:32,height:32}}>
    <path d="M3 8C3 6.895 3.895 6 5 6H13L16 10H27C28.105 10 29 10.895 29 12V24C29 25.105 28.105 26 27 26H5C3.895 26 3 25.105 3 24V8Z" fill="#fff"/>
  </svg>
);

const RemoteServerSVG = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:32,height:32}}>
    <path d="M16 6L6 12v8l10 6 10-6v-8L16 6z" fill="#fff"/>
    <path d="M16 12v14M10 15l12 7M10 21l12-7" stroke="#10b981" strokeWidth="2"/>
  </svg>
);

const DropFolderSVG = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:28,height:28}}>
    <path d="M3 8C3 6.895 3.895 6 5 6H13L16 10H27C28.105 10 29 10.895 29 12V24C29 25.105 28.105 26 27 26H5C3.895 26 3 25.105 3 24V8Z" fill="#f59e0b"/>
    <path d="M3 6H12L15 10H3V6Z" fill="#fbbf24"/>
  </svg>
);

const RemoteZoneSVG = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:28,height:28}}>
    <path d="M16 6L6 12v8l10 6 10-6v-8L16 6z" fill="#fff"/>
    <path d="M16 12v14M10 15l12 7M10 21l12-7" stroke="#10b981" strokeWidth="2"/>
  </svg>
);

const StatusIcon = ({ success }) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16 }}>
    {success ? (
      <path d="M6 10.5L3.5 8l-1 1 3.5 3.5 7-7-1-1-6 6Z" fill="#16a34a" />
    ) : (
      <path d="M4.5 4.5l7 7m0-7l-7 7" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
    )}
  </svg>
);

const PatientIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, marginRight: 4, flexShrink: 0 }}>
    <circle cx="10" cy="6" r="3" stroke="#475569" strokeWidth="1.5" />
    <path d="M4.5 16c0-2.485 2.015-4.5 4.5-4.5h2c2.485 0 4.5 2.015 4.5 4.5" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MrnIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, marginRight: 4, flexShrink: 0 }}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="#475569" strokeWidth="1.5" />
    <path d="M5.5 8.5h9" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5.5 11.5h4" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SourceIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, marginRight: 4, flexShrink: 0 }}>
    <path d="M3 6.5C3 5.672 3.672 5 4.5 5h4.5l2 2h5c.828 0 1.5.672 1.5 1.5v6c0 .828-.672 1.5-1.5 1.5h-12C3.672 16 3 15.328 3 14.5v-8Z" stroke="#475569" strokeWidth="1.5" />
  </svg>
);

const ViewsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, marginRight: 4, flexShrink: 0 }}>
    <rect x="3.5" y="3.5" width="5" height="5" rx="1" stroke="#475569" strokeWidth="1.5" />
    <rect x="11.5" y="3.5" width="5" height="5" rx="1" stroke="#475569" strokeWidth="1.5" />
    <rect x="3.5" y="11.5" width="5" height="5" rx="1" stroke="#475569" strokeWidth="1.5" />
    <rect x="11.5" y="11.5" width="5" height="5" rx="1" stroke="#475569" strokeWidth="1.5" />
  </svg>
);

function App() {
  const [savedNames, setSavedNames]       = useState(['sanjai', 'Jane Doe', 'John Smith']);
  const [patientName, setPatientName]     = useState('');
  const [mrn, setMrn]                     = useState('demo-mrn');
  const [acIndex, setAcIndex]             = useState(-1);
  const [mode, setMode]                   = useState(null);
  const [folderFiles, setFolderFiles]     = useState([]);
  const [dragOver, setDragOver]           = useState(false);
  const [remoteFolders, setRemoteFolders] = useState([]);
  const [remoteCountText, setRemoteCountText] = useState('Connecting to server...');
  const [selectedRemoteFolder, setSelectedRemoteFolder] = useState('');
  const [remotePreview, setRemotePreview] = useState(null);
  const [fileStatusError, setFileStatusError] = useState(null);
  const [modalOpen, setModalOpen]         = useState(false);
  const [modalTitle, setModalTitle]       = useState('Uploading images...');
  const [modalSub, setModalSub]           = useState('Uploading mammography files to server');
  const [progressVisible, setProgressVisible] = useState(true);
  const [progressPct, setProgressPct]     = useState(0);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [latestPreviews, setLatestPreviews]     = useState({});
  const [resultsActive, setResultsActive] = useState(false);
  const [inferenceError, setInferenceError] = useState(null);

  const cancelRequestedRef = useRef(false);
  const chartCanvasRef     = useRef(null);
  const chartRef           = useRef(null);
  const folderInputRef     = useRef(null);
  const apiKeyRef          = useRef('');

  useEffect(() => {
    apiKeyRef.current = window.localStorage.getItem('oncoserveApiKey') || '';
  }, []);

  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, []);

  const matches = useMemo(() => {
    const val = patientName.trim().toLowerCase();
    if (!val) return [];
    return savedNames.filter((n) => n.toLowerCase().startsWith(val) && n.toLowerCase() !== val);
  }, [patientName, savedNames]);

  const localStatus = useMemo(() => {
    const results = NEEDED.map((item) => ({
      ...item,
      found: !!findFileForView(folderFiles, item.key),
    }));
    return { results, allFound: results.every((item) => item.found) };
  }, [folderFiles]);

  const remoteStatus = useMemo(() => {
    if (!remotePreview) return null;
    const results = NEEDED.map((item) => ({
      ...item,
      found: Boolean((remotePreview.files || {})[item.api]),
      filename: (remotePreview.files || {})[item.api] || item.label,
    }));
    return { results, allFound: Boolean(remotePreview.all_found) };
  }, [remotePreview]);

  const fileStatus    = mode === 'remote' ? remoteStatus : mode === 'local' ? localStatus : null;
  const canRun        = mode === 'local'  ? Boolean(localStatus?.allFound) : mode === 'remote' ? Boolean(remoteStatus?.allFound && selectedRemoteFolder) : false;
  const showFileStatus = mode === 'local' ? folderFiles.length > 0 : mode === 'remote' ? Boolean(remotePreview) : false;

  /* Chart */
  useEffect(() => {
    if (!resultsActive || !latestPrediction || !chartCanvasRef.current) return;
    const perYear = [
      latestPrediction.year_1 || 0,
      latestPrediction.year_2 || 0,
      latestPrediction.year_3 || 0,
      latestPrediction.year_4 || 0,
      latestPrediction.year_5 || 0,
    ];
    const cumulative = perYear.reduce((acc, value, index) => {
      acc.push(+((acc[index - 1] || 0) + value).toFixed(3));
      return acc;
    }, []);
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(chartCanvasRef.current.getContext('2d'), {
      data: {
        labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
        datasets: [
          {
            type: 'line',
            label: 'Cumulative risk',
            data: cumulative,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,.12)',
            borderWidth: 2.5,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 5,
            tension: 0.35,
            fill: false,
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: 'Per-year risk',
            data: perYear,
            backgroundColor: 'rgba(251,113,133,.65)',
            borderRadius: 5,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 24, padding: 16, font: { size: 12 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%` } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => `${v}%`, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }, [resultsActive, latestPrediction]);

  function buildAuthHeaders(extra) {
    const headers = extra ? { ...extra } : {};
    if (apiKeyRef.current) headers['X-API-Key'] = apiKeyRef.current;
    return headers;
  }

  function getApiUrl(endpoint) {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return cleanBase + cleanEndpoint;
  }

  async function selectMode(nextMode) {
    setMode(nextMode);
    setFolderFiles([]);
    setRemotePreview(null);
    setFileStatusError(null);
    setInferenceError(null);
    setSelectedRemoteFolder('');
    if (folderInputRef.current) folderInputRef.current.value = '';
    if (nextMode === 'remote') await loadRemoteFolders();
  }

  async function loadRemoteFolders() {
    setRemoteCountText('Connecting to server...');
    try {
      const response = await fetch(getApiUrl('/list-remote-folders'), { headers: buildAuthHeaders() });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await parseJsonResponse(response, '/list-remote-folders');
      const folders = data.folders || [];
      setRemoteFolders(folders);
      setRemoteCountText(
        folders.length === 0
          ? 'No patient folders available on server'
          : `${folders.length} patient folder${folders.length > 1 ? 's' : ''} available`,
      );
    } catch (error) {
      setRemoteCountText('Showing cached folders due to connection error');
      setFileStatusError(error.message);
    }
  }

  async function onRemoteFolderSelect(folderName) {
    setSelectedRemoteFolder(folderName);
    setRemotePreview(null);
    setFileStatusError(null);
    setInferenceError(null);
    if (!folderName) return;
    try {
      const response = await fetch(getApiUrl('/preview-remote-folder'), {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ folder_name: folderName }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const result = await parseJsonResponse(response, '/preview-remote-folder');
      if (result.error) throw new Error(result.msg || 'Failed to preview folder');
      setRemotePreview(result);
    } catch (error) {
      setFileStatusError(error.message);
    }
  }

  function onFolderChange(event) {
    const files = Array.from(event.target.files || []);
    setFolderFiles(files);
    setFileStatusError(null);
    setInferenceError(null);
    event.target.value = '';
  }

  async function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    try {
      const files = await getDroppedFiles(event.dataTransfer);
      setFolderFiles(files);
      setFileStatusError(null);
      setInferenceError(null);
      if (!mode) setMode('local');
    } catch (error) {
      setFileStatusError('Unable to read the dropped folder. Please try browsing for it instead.');
    }
  }

  async function runInference() {
    cancelRequestedRef.current = false;
    setModalOpen(true);
    setLatestPrediction(null);
    setLatestPreviews({});
    setInferenceError(null);

    try {
      let result;

      if (mode === 'remote') {
        // ── REMOTE mode: simple staged animation then fetch ──────────────
        if (!selectedRemoteFolder) throw new Error('Please select a remote folder first');
        setProgressVisible(true);
        setProgressPct(0);

        // Background staged animation (concurrent with fetch)
        let stopAnim = false;
        const stoppedOrCancelled = () => cancelRequestedRef.current || stopAnim;
        const bgAnim = (async () => {
          try {
            setModalTitle('Loading remote files');
            setModalSub(`Reading: ${selectedRemoteFolder}`);
            await animateProgress([20], 2000, setProgressPct, stoppedOrCancelled);
            if (stoppedOrCancelled()) return;
            setModalTitle('Converting DICOMs to PNG');
            setModalSub('Processing 4 mammography views...');
            await animateProgress([55], 7000, setProgressPct, stoppedOrCancelled);
                  setModalTitle('Running AI inference model');
            setModalSub(patientName ? `Analyzing ${patientName}'s mammography images` : 'Analyzing mammography images...');
            await animateProgress([88], 220000, setProgressPct, stoppedOrCancelled);
            if (stoppedOrCancelled()) return;
            setModalTitle('Computing 5-year risk...');
            setModalSub('Calibrating breast cancer predictions');
            await animateProgress([95], 30000, setProgressPct, stoppedOrCancelled);
          } catch (e) { /* swallow cancellation */ }
        })();

        const response = await fetch(getApiUrl('/predict-remote'), {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ folder_name: selectedRemoteFolder }),
        });
        stopAnim = true;
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        result = await parseJsonResponse(response, '/predict-remote');
        if (result.error) throw new Error(result.msg || 'Inference failed');
        await bgAnim;

      } else {
        // ── LOCAL mode: concurrent staged progress + real fetch ──────────
        setProgressVisible(true);
        setProgressPct(0);

        // Start the fetch immediately (don't await yet)
        const formData = buildFormData(folderFiles);

        // Background animation running concurrently with the real fetch
        let stopAnim = false;
        const stoppedOrCancelled = () => cancelRequestedRef.current || stopAnim;
        const bgAnim = (async () => {
          try {
            setModalTitle('Uploading mammography files');
            setModalSub('Transferring 4 DICOM files to server');
            await animateProgress([18], 2000, setProgressPct, stoppedOrCancelled);
            if (stoppedOrCancelled()) return;
            setModalTitle('Converting DICOMs to PNG');
            setModalSub('Processing 4 mammography views...');
            await animateProgress([48], 7000, setProgressPct, stoppedOrCancelled);
            if (stoppedOrCancelled()) return;
            setModalTitle('Running AI inference model');
            setModalSub(patientName ? `Analyzing ${patientName}'s mammography images` : 'Analyzing mammography images...');
            await animateProgress([88], 220000, setProgressPct, stoppedOrCancelled);
            if (stoppedOrCancelled()) return;
            setModalTitle('Computing 5-year risk...');
            setModalSub('Calibrating breast cancer predictions');
            await animateProgress([95], 30000, setProgressPct, stoppedOrCancelled);
          } catch (e) { /* swallow cancellation */ }
        })();

        const response = await fetch(getApiUrl('/predict'), {
          method: 'POST',
          body: formData,
          headers: buildAuthHeaders(),
        });
        stopAnim = true; // stop background animation when fetch returns
        result = await parseJsonResponse(response, '/predict');
        if (!response.ok || result.error) throw new Error(result.msg || 'Inference failed');
        await bgAnim;
      }

      // ── Finishing up ─────────────────────────────────────────────────
      setModalTitle('Analysis complete');
      setModalSub('Preparing your results...');
      await animateProgress([100], 600, setProgressPct, () => cancelRequestedRef.current);
      await sleep(400, () => cancelRequestedRef.current);

      setLatestPrediction(result.prediction);
      setLatestPreviews(result.previews || {});
      setModalOpen(false);
      setResultsActive(true);
      if (patientName && !savedNames.includes(patientName)) {
        setSavedNames((current) => [patientName, ...current]);
      }
    } catch (error) {
      setModalOpen(false);
      if (error.message !== 'Cancelled') {
        setInferenceError(error.message);
      }
    }
  }

  function cancelUpload() {
    cancelRequestedRef.current = true;
    setModalOpen(false);
  }

  function resetToUpload() {
    setResultsActive(false);
    setPatientName('');
    setMrn('demo-mrn');
    setMode(null);
    setFolderFiles([]);
    setRemotePreview(null);
    setSelectedRemoteFolder('');
    setFileStatusError(null);
    setInferenceError(null);
    setLatestPrediction(null);
    setLatestPreviews({});
    setAcIndex(-1);
  }

  function onNameKey(event) {
    if (!matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAcIndex((idx) => Math.min(idx + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAcIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === 'Enter' && acIndex >= 0) {
      event.preventDefault();
      setPatientName(matches[acIndex]);
      setAcIndex(-1);
    } else if (event.key === 'Escape') {
      setAcIndex(-1);
    }
  }

  const folderName = mode === 'remote' ? selectedRemoteFolder : getFolderName(folderFiles);
  const displayName = patientName.trim() || folderName || '';
  const pageTitle = resultsActive
    ? `OncoTraceAI 1–5 Year Cancer Risk Prediction${displayName ? ` for ${displayName}` : ''}`
    : 'OncoTraceAI 1–5 Year Cancer Risk Prediction';
  const perYear = latestPrediction
    ? [latestPrediction.year_1 || 0, latestPrediction.year_2 || 0, latestPrediction.year_3 || 0, latestPrediction.year_4 || 0, latestPrediction.year_5 || 0]
    : [0, 0, 0, 0, 0];
  const total5yr  = perYear.reduce((sum, v) => sum + v, 0);
  const riskBadge = getRiskBadge(total5yr);

  return (
    <div>
      {/* ── HEADER ── */}
      <header>
        <div className="header-inner">
          <div className="logo-box">
            <img src={`${import.meta.env.BASE_URL}oncotraceai.webp`} alt="OncoTraceAI logo" style={{ height: '70px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="header-title">
            <h1>{pageTitle}</h1>
            {!resultsActive && <div className="header-subtitle">Upload one exam: L-CC, L-MLO, R-CC, R-MLO</div>}
          </div>
          <button
            className={resultsActive ? 'btn-new-exam visible' : 'btn-new-exam'}
            type="button"
            onClick={resetToUpload}
          >
            <span>↻</span> New Exam
          </button>
        </div>
      </header>

      {/* ── MODAL ── */}
      <div className={modalOpen ? 'modal-overlay active' : 'modal-overlay'}>
        <div className="modal-box">
          <div className="modal-spinner" />
          <h2>{modalTitle}</h2>
          <p className="modal-sub">{modalSub}</p>
          {progressVisible && (
            <div className="progress-wrap">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="progress-pct">{Math.round(progressPct)}%</div>
            </div>
          )}
          <button className="btn-cancel" type="button" onClick={cancelUpload}>Cancel</button>
        </div>
      </div>

      <main>
        <div className="card">
          {/* ── UPLOAD SECTION ── */}
          {!resultsActive && (
            <div id="uploadSection" style={{ position: 'relative' }}>
              {(folderFiles.length > 0 || selectedRemoteFolder || inferenceError || fileStatusError) && (
                <button 
                  type="button" 
                  onClick={resetToUpload}
                  style={{ position: 'absolute', top: '-10px', right: '0px', background: '#3b82f6', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>↻</span> New Exam
                </button>
              )}
              {/* Patient row */}
              <div className="patient-row">
                <div className="field" id="nameField">
                  <label htmlFor="patientName">Patient name</label>
                  <input
                    type="text"
                    id="patientName"
                    placeholder="e.g., Jane Doe"
                    autoComplete="off"
                    value={patientName}
                    onChange={(e) => { setPatientName(e.target.value); setAcIndex(-1); }}
                    onKeyDown={onNameKey}
                  />
                  {matches.length > 0 && (
                    <div className="autocomplete-list open">
                      {matches.map((name, index) => (
                        <div
                          key={name}
                          className="autocomplete-item"
                          style={{ background: index === acIndex ? 'var(--blue-light)' : '' }}
                          onMouseDown={() => { setPatientName(name); setAcIndex(-1); }}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="mrn">MRN</label>
                  <input type="text" id="mrn" placeholder="demo-mrn" value={mrn} onChange={(e) => setMrn(e.target.value)} />
                </div>
              </div>

              {/* Help message (shown before mode selected) */}
              {!mode && (
                <>
                  <div className="help-message">
                    <h4>Choose how you'd like to upload your data</h4>
                    <p>Select Local to browse files from your computer, or Remote to access folders stored on the server</p>
                  </div>
                  <div className="mode-hint">Choose how you want to upload your mammography files</div>
                </>
              )}

              {/* Mode selection cards */}
              <div className="mode-selection">
                {/* LOCAL card */}
                <div
                  className={mode === 'local' ? 'mode-card selected' : 'mode-card'}
                  onClick={() => selectMode('local')}
                >
                  <div className="check-badge"><CheckBadgeSVG /></div>
                  <div className="icon-wrap">
                    <LocalFolderSVG />
                  </div>
                  <h3>Local Upload</h3>
                  <p>Upload from your computer</p>
                </div>

                {/* REMOTE card */}
                <div
                  className={mode === 'remote' ? 'mode-card selected' : 'mode-card'}
                  onClick={() => selectMode('remote')}
                >
                  <div className="check-badge"><CheckBadgeSVG /></div>
                  <div className="icon-wrap" style={{ background: '#10b981' }}>
                    <RemoteServerSVG />
                  </div>
                  <h3>Remote Access</h3>
                  <p>Load from server folders</p>
                </div>
              </div>

              {/* Local upload container */}
              <div className={mode === 'local' ? 'upload-container visible' : 'upload-container'}>
                {folderFiles.length === 0 && (
                  <div
                    className={dragOver ? 'drop-zone drag-over' : 'drop-zone'}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      directory=""
                      webkitdirectory=""
                      mozdirectory=""
                      accept=".dcm"
                      onChange={onFolderChange}
                    />
                    <div className="folder-icon-wrap">
                      <DropFolderSVG />
                    </div>
                    <h3>Choose your mammography folder</h3>
                    <p className="drop-hint">Drop a folder containing the 4 DICOM views, or browse to select the folder</p>
                    <div className="btn-choose">Browse Folder</div>
                    <p className="folder-req">Must contain: L-CC.dcm, L-MLO.dcm, R-CC.dcm, R-MLO.dcm</p>
                  </div>
                )}
              </div>

              {/* Remote upload container */}
              <div className={mode === 'remote' ? 'upload-container visible' : 'upload-container'}>
                {!selectedRemoteFolder && (
                  <div className="remote-zone">
                    <div className="folder-icon-wrap" style={{ background: '#10b981' }}>
                      <RemoteZoneSVG />
                    </div>
                    <h3>Select folder from server</h3>
                    <p className="drop-hint">Choose a patient folder from the remote server</p>
                    <select
                      className="remote-select"
                      value={selectedRemoteFolder}
                      onChange={(e) => onRemoteFolderSelect(e.target.value)}
                    >
                      <option value="">-- Select a patient folder --</option>
                      {remoteFolders.map((folder) => (
                      <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
                    <p className="folder-count">{remoteCountText}</p>
                  </div>
                )}
              </div>

              {/* File status box */}
              {showFileStatus && fileStatus && (
                <div className={fileStatus.allFound ? 'file-status-box visible' : 'file-status-box visible error'}>
                  <div
                    className="file-status-title"
                    style={{ color: fileStatus.allFound ? 'var(--green)' : '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <StatusIcon success={fileStatus.allFound} />
                    {fileStatus.allFound ? 'All files ready for inference' : 'Some files missing'}
                  </div>
                  <div className="file-status-grid">
                    {fileStatus.results.map((item) => {
                      const realFile = mode === 'local' ? findFileForView(folderFiles, item.key) : null;
                      return (
                        <div className={`file-row ${item.found ? 'found' : 'missing'}`} key={item.key}>
                          <span className="file-row-icon"><StatusIcon success={item.found} /></span>
                          <div className="file-row-info">
                            <span className="file-row-label">{item.display}</span>
                            <span className="file-row-name">
                              {mode === 'local'
                                ? (realFile ? realFile.name : item.label)
                                : (item.filename || item.label)}
                            </span>
                          </div>
                          <span className={`file-row-status ${item.found ? '' : 'bad'}`}>
                            {item.found ? 'Ready' : 'Missing'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* File-status error (e.g. connection errors) */}
              {fileStatusError && (
                <div className="file-status-box visible error">
                  <div className="file-status-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusIcon success={false} />
                    Error
                  </div>
                  <div className="file-status-list">{fileStatusError}</div>
                </div>
              )}

              {/* Inference error shown inline */}
              {inferenceError && (
                <div className="file-status-box visible error">
                  <div className="file-status-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusIcon success={false} />
                    Inference failed
                  </div>
                  <div className="file-status-list" style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                    {inferenceError}
                  </div>
                </div>
              )}

              {/* Run row */}
              <div className={canRun ? 'run-row visible' : 'run-row'} style={{ justifyContent: 'center', flexDirection: 'column', gap: '0.7rem' }}>
                <button 
                  className="btn-run-inference" 
                  type="button" 
                  onClick={runInference}
                  style={{ padding: '0.85rem 2.5rem', fontSize: '1.15rem' }}
                >
                  Run inference
                </button>
                <span className="run-note" style={{ textAlign: 'center' }}>This UI never stores uploads. Missing tags are patched in memory.</span>
              </div>

              {/* Browse again / Re-upload buttons */}
              {(folderFiles.length > 0 || selectedRemoteFolder) && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: canRun ? '0' : '1.5rem', marginBottom: '1rem' }}>
                  {!canRun && (
                    <button 
                      type="button" 
                      onClick={() => { setFolderFiles([]); setSelectedRemoteFolder(''); setFileStatusError(null); setInferenceError(null); setShowFileStatus(false); setFileStatus(null); }}
                      style={{ padding: '0.85rem 2.5rem', fontSize: '1.15rem', borderRadius: '99px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Re-upload (Missing Files)
                    </button>
                  )}
                </div>
              )}

              <div className="bottom-disclaimer">
                FOR RESEARCH/PRESENTATION mammography DICOMs (L/R × CC/MLO). This is a research demo; not for clinical decisions.
              </div>
            </div>
          )}

          {/* ── RESULTS SECTION ── */}
          <div id="resultsSection" className={resultsActive ? 'active' : ''}>

            {/* Patient info banner */}
            <div className="patient-banner">
              <div className="patient-banner-row">
                <div className="patient-banner-field">
                  <span className="pb-label" style={{ fontSize: '0.8rem' }}><PatientIcon />Patient</span>
                  <span className="pb-value" style={{ fontSize: '1.25rem' }}>
                    {patientName || (mode === 'remote' ? selectedRemoteFolder : (getFolderName(folderFiles) || <em style={{opacity:0.5}}>Not specified</em>))}
                  </span>
                </div>
                <div className="patient-banner-field">
                  <span className="pb-label" style={{ fontSize: '0.8rem' }}><MrnIcon />MRN</span>
                  <span className="pb-value" style={{ fontSize: '1.25rem' }}>{mrn || '—'}</span>
                </div>
                <div className="patient-banner-field">
                  <span className="pb-label"><SourceIcon />Source</span>
                  <span className="pb-value">
                    {mode === 'remote' ? `Server: ${selectedRemoteFolder}` : 'Local upload'}
                  </span>
                </div>
                <div className="patient-banner-field">
                  <span className="pb-label"><ViewsIcon />Views</span>
                  <span className="pb-value">{NEEDED.map(n => n.display).join(' · ')}</span>
                </div>
              </div>
              {mode === 'local' && folderFiles.length > 0 && (
                <div className="patient-banner-files">
                  {NEEDED.map((item) => {
                    const realFile = findFileForView(folderFiles, item.key);
                    return (
                      <span className="pb-file" key={item.key}>
                        <span className="pb-file-view">{item.display}</span>
                        <span className="pb-file-name">{realFile ? realFile.name : '—'}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="results-grid">
              <div className="chart-panel">
                <h3>5-Year Risk Chart</h3>
                <div className="chart-wrap">
                  <canvas ref={chartCanvasRef} />
                </div>
                <div className={`risk-badge ${riskBadge.className}`}>{riskBadge.text}</div>
              </div>

              <div className="images-panel">
                <h3>Mammography Views</h3>
                <div className="images-grid">
                  {NEEDED.map((item) => {
                    const src = latestPreviews[item.api];
                    const realFile = mode === 'local' ? findFileForView(folderFiles, item.key) : null;
                    return (
                      <div className="img-slot" key={item.key}>
                        {src ? (
                          <img src={src} alt={item.display} />
                        ) : (
                          <span className="no-img">No preview</span>
                        )}
                        <div className="img-label">
                          <strong>{item.display}</strong>
                          {realFile && <span className="img-filename"> · {realFile.name}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bottom-disclaimer" style={{ marginTop: '1.2rem' }}>
              FOR RESEARCH/PRESENTATION mammography DICOMs (L/R × CC/MLO). This is a research demo; not for clinical decisions.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Helpers ── */

function getFolderName(files) {
  if (!files || files.length === 0) return null;
  const f = files[0];
  if (f.webkitRelativePath) return f.webkitRelativePath.split('/')[0];
  if (f.customPath) {
    const parts = f.customPath.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  }
  return null;
}

function findFileForView(folderFiles, viewKey) {
  return folderFiles.find((file) => {
    if (!/\.dcm$/i.test(file.name)) return false;
    const normalizedName = file.name.replace(/\.dcm$/i, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normalizedName === viewKey || normalizedName.includes(viewKey);
  });
}

function buildFormData(folderFiles) {
  const fd = new FormData();
  for (const item of NEEDED) {
    const file = findFileForView(folderFiles, item.key);
    if (!file) throw new Error(`Missing required file ${item.key}.dcm`);
    fd.append(item.api, file, file.name);
  }
  return fd;
}

async function getDroppedFiles(dataTransfer) {
  const items   = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (!entries.length) return Array.from(dataTransfer.files || []);
  const files = await Promise.all(entries.map(readDroppedEntry));
  return files.flat();
}

function readDroppedEntry(entry) {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file((f) => {
        f.customPath = entry.fullPath;
        resolve(f);
      }, reject);
    });
  }
  if (!entry.isDirectory) return Promise.resolve([]);
  const reader = entry.createReader();
  const readAllEntries = () =>
    new Promise((resolve, reject) => {
      const all = [];
      const readBatch = () =>
        reader.readEntries(
          (batch) => {
            if (batch.length) { all.push(...batch); readBatch(); }
            else resolve(all);
          },
          (error) => reject(error),
        );
      readBatch();
    });
  return readAllEntries()
    .then((children) => Promise.all(children.map(readDroppedEntry)))
    .then((children) => children.flat());
}

function getRiskBadge(total5yr) {
  if (total5yr < 5)  return { className: 'low',       text: `Low 5-yr risk: ${total5yr.toFixed(2)}%` };
  if (total5yr < 10) return { className: 'moderate',  text: `Moderate 5-yr risk: ${total5yr.toFixed(2)}%` };
  if (total5yr < 20) return { className: 'high',      text: `High 5-yr risk: ${total5yr.toFixed(2)}%` };
  return               { className: 'very-high', text: `Very high 5-yr risk: ${total5yr.toFixed(2)}%` };
}

async function parseJsonResponse(response, endpointName) {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    const backendHint = response.status >= 500
      ? ' Ensure Flask backend is running at http://127.0.0.1:5009.'
      : '';
    const sample = rawText.trim().slice(0, 200);
    throw new Error(`Invalid JSON response from ${endpointName} (HTTP ${response.status}).${backendHint}${sample ? ' Response: ' + sample : ''}`);
  }
}

async function animateProgress(stops, totalMs, onTick, isCancelled) {
  const pause = Math.max(30, Math.floor(totalMs / stops.length));
  let current = 0;
  for (const stop of stops) {
    if (isCancelled()) throw new Error('Cancelled');
    const step = Math.max(1, Math.floor((stop - current) / 6));
    while (current < stop) {
      if (isCancelled()) throw new Error('Cancelled');
      current = Math.min(stop, current + step);
      onTick(current);
      await sleep(40, isCancelled);
    }
    await sleep(pause / 2, isCancelled);
  }
}

function sleep(ms, isCancelled) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (isCancelled?.()) { reject(new Error('Cancelled')); return; }
      if (Date.now() - started >= ms) { resolve(); return; }
      setTimeout(tick, 25);
    };
    tick();
  });
}

export default App;
