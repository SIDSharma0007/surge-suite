import React, { useState, useEffect } from 'react';
import './FaceAuthentication.css';

const STATUS_DETAILS = {
  INITIALIZING: {
    title: "System Initializing",
    subtitle: "Loading neural network models...",
    class: "state-initializing",
    colorRgb: "245, 158, 11" // Amber
  },
  READY: {
    title: "Ready to Scan",
    subtitle: "Align your face within the frame",
    class: "state-ready",
    colorRgb: "59, 130, 246" // Blue
  },
  SCANNING: {
    title: "Scanning Face",
    subtitle: "Analyzing facial geometry details...",
    class: "state-scanning",
    colorRgb: "6, 182, 212" // Cyan
  },
  VERIFYING: {
    title: "Verifying Identity",
    subtitle: "Matching embeddings with database...",
    class: "state-verifying",
    colorRgb: "139, 92, 246" // Purple
  },
  SUCCESS: {
    title: "Verification Successful",
    subtitle: "Welcome back! Access granted.",
    class: "state-success",
    colorRgb: "16, 185, 129" // Emerald Green
  },
  UNKNOWN_USER: {
    title: "Access Denied",
    subtitle: "Face not recognized in the system.",
    class: "state-unknown",
    colorRgb: "239, 68, 68" // Crimson Red
  }
};

function StatusText({ title, subtitle }) {
  return (
    <div className="status-text-container">
      <h3 className="status-title">{title}</h3>
      <p className="status-subtitle">{subtitle}</p>
    </div>
  );
}

function ScannerAnimation({ state }) {
  const currentStatus = STATUS_DETAILS[state] || STATUS_DETAILS.READY;
  
  return (
    <div className="scanner-container">
      <div className="scanner-corner top-left" />
      <div className="scanner-corner top-right" />
      <div className="scanner-corner bottom-left" />
      <div className="scanner-corner bottom-right" />

      <div className="scanner-frame">
        <div className="scanner-grid" />
        
        {(state === 'INITIALIZING' || state === 'VERIFYING') && (
          <div className="scanner-spinner" />
        )}

        {state === 'SCANNING' && (
          <div className="scanner-laser" />
        )}

        {state === 'SUCCESS' && (
          <div className="scanner-result success-mark">
            <svg viewBox="0 0 52 52" style={{ width: '100%', height: '100%' }}>
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
        )}

        {state === 'UNKNOWN_USER' && (
          <div className="scanner-result error-mark">
            <svg viewBox="0 0 52 52" style={{ width: '100%', height: '100%' }}>
              <circle className="cross-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="cross-line-1" fill="none" d="M16 16 L36 36" />
              <path className="cross-line-2" fill="none" d="M36 16 L16 36" />
            </svg>
          </div>
        )}

        {state !== 'SUCCESS' && state !== 'UNKNOWN_USER' && (
          <div className="scanner-silhouette">
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <path 
                d="M50 16 C38 16, 29 26, 29 39 C29 53, 39 61, 41 67 C39 71, 24 73, 19 86 L81 86 C76 73, 61 71, 59 67 C61 61, 71 53, 71 39 C71 26, 62 16, 50 16 Z" 
                fill="none" 
                stroke={`rgb(${currentStatus.colorRgb})`} 
                strokeWidth="2"
                style={{ transition: 'stroke 0.4s ease', opacity: 0.35 }}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FaceAuthentication({ state: suppliedState }) {
  const [activeState, setActiveState] = useState(suppliedState || 'READY');

  useEffect(() => {
    if (suppliedState) {
      setActiveState(suppliedState);
    }
  }, [suppliedState]);

  const currentStatus = STATUS_DETAILS[activeState] || STATUS_DETAILS.READY;

  return (
    <div className="face-auth-wrapper">
      <div 
        className={`face-auth-card state-${activeState.toLowerCase()}`} 
        style={{ '--state-color-rgb': currentStatus.colorRgb }}
      >
        <div className="face-auth-glow" />
        
        <div className="face-auth-header">
          <div className="face-auth-badge">Secure Biometric</div>
          <h2 className="face-auth-title">Biometric Lock</h2>
        </div>

        <div className="face-auth-body">
          <ScannerAnimation state={activeState} />
        </div>

        <div className="face-auth-footer">
          <StatusText title={currentStatus.title} subtitle={currentStatus.subtitle} />
        </div>
      </div>

      {/* Presentational Demo Controller Console for reference and quick testing */}
      <div className="face-auth-demo-bar">
        {Object.keys(STATUS_DETAILS).map((stateKey) => {
          const detail = STATUS_DETAILS[stateKey];
          return (
            <button
              key={stateKey}
              onClick={() => setActiveState(stateKey)}
              className={`demo-btn ${activeState === stateKey ? 'active' : ''}`}
              style={{ '--btn-color-rgb': detail.colorRgb }}
            >
              {stateKey}
            </button>
          );
        })}
      </div>
    </div>
  );
}
