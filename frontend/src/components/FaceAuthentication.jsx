import React, { useState, useEffect } from 'react';
import './FaceAuthentication.css';

const STATUS_DETAILS = {
  INITIALIZING: {
    title: "Face ID Initializing",
    subtitle: "Setting up secure camera stream...",
    class: "state-initializing",
    color: "var(--text-muted)"
  },
  READY: {
    title: "Face ID",
    subtitle: "Position your face in front of the camera",
    class: "state-ready",
    color: "var(--text-primary)"
  },
  SCANNING: {
    title: "Scanning Face",
    subtitle: "Analyzing unique facial characteristics...",
    class: "state-scanning",
    color: "var(--text-primary)"
  },
  VERIFYING: {
    title: "Authenticating",
    subtitle: "Verifying credentials with database...",
    class: "state-verifying",
    color: "var(--text-primary)"
  },
  SUCCESS: {
    title: "Unlocked",
    subtitle: "Identity successfully verified",
    class: "state-success",
    color: "var(--status-success)"
  },
  UNKNOWN_USER: {
    title: "Not Recognized",
    subtitle: "Face matching profile not found",
    class: "state-unknown",
    color: "var(--status-error)"
  }
};

function StatusText({ title, subtitle, state }) {
  const current = STATUS_DETAILS[state] || STATUS_DETAILS.READY;
  return (
    <div className="faceid-status-text">
      <h3 className="faceid-title" style={{ color: current.color }}>
        {title}
      </h3>
      <p className="faceid-subtitle">{subtitle}</p>
    </div>
  );
}

function ScannerAnimation({ state }) {
  return (
    <div className={`faceid-scanner-box state-${state.toLowerCase()}`}>
      {/* Restored Single Premium Ring SVG structure */}
      <div className="faceid-ring">
        <svg viewBox="0 0 100 100" className="faceid-ring-svg">
          <circle cx="50" cy="50" r="46" className="faceid-ring-bg" />
          <circle cx="50" cy="50" r="46" className="faceid-ring-active" />
        </svg>
      </div>

      {/* Sweep Laser Effect */}
      <div className="faceid-laser-sweep" />

      {/* Central Visual Graphic */}
      <div className="faceid-center-graphic">
        {state === 'SUCCESS' && (
          /* Checkmark Drawing */
          <div className="faceid-checkmark">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="23" className="success-circle" />
              <path d="M16 27 l7 7 l14 -14" className="success-path" />
            </svg>
          </div>
        )}

        {state === 'UNKNOWN_USER' && (
          /* Cross/Warning Drawing */
          <div className="faceid-cross">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="23" className="error-circle" />
              <path d="M17 17 L35 35 M35 17 L17 35" className="error-path" />
            </svg>
          </div>
        )}

        {state !== 'SUCCESS' && state !== 'UNKNOWN_USER' && (
          /* Face Silhouette */
          <div className="faceid-silhouette">
            <svg viewBox="0 0 100 100" className="silhouette-svg">
              <path 
                d="M50 20 C38 20, 30 28, 30 40 C30 52, 38 60, 40 65 C39 69, 25 71, 20 82 L80 82 C75 71, 61 69, 60 65 C62 60, 70 52, 70 40 C70 28, 62 20, 50 20 Z" 
                className="silhouette-path"
              />
              <circle cx="42" cy="40" r="2" className="silhouette-eye" />
              <circle cx="58" cy="40" r="2" className="silhouette-eye" />
              <path d="M 45 52 Q 50 56 55 52" className="silhouette-mouth" />
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
    <div className="faceid-container">
      <div className={`faceid-card ${currentStatus.class}`}>
        <div className="faceid-header-badge">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          Secure Auth
        </div>
        
        <div className="faceid-body">
          <ScannerAnimation state={activeState} />
        </div>

        <div className="faceid-footer">
          <StatusText title={currentStatus.title} subtitle={currentStatus.subtitle} state={activeState} />
        </div>
      </div>

      {/* Modern minimal Monochrome Demo Toggle Bar */}
      <div className="faceid-demo-bar">
        {Object.keys(STATUS_DETAILS).map((stateKey) => (
          <button
            key={stateKey}
            onClick={() => setActiveState(stateKey)}
            className={`demo-btn ${activeState === stateKey ? 'active' : ''}`}
          >
            {stateKey.substring(0, 4)}
          </button>
        ))}
      </div>
    </div>
  );
}
