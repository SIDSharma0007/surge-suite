import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authServices } from '../services/authServices';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import CameraCapture from '../components/CameraCapture';
import FaceAuthentication from '../components/FaceAuthentication';
import ThemeToggle from '../components/ThemeToggle';
import { WifiOff, AlertCircle } from 'lucide-react';

function Landing() {
  const cameraRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Biometric flow states: INITIALIZING, SCANNING, VERIFYING, SUCCESS, UNKNOWN_USER
  const [authState, setAuthState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);

  // Status check endpoint hook
  const getStatus = useCallback(() => authServices.status(), []);
  const { execute: checkStatus, data, loading, error } = useApi(getStatus);

  // Verification request hook
  const { execute: verifyFace } = useApi(authServices.verify);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Derive the display status from hook state
  let displayStatus = 'Checking...';
  if (!loading) {
    if (error) {
      displayStatus = 'Offline';
    } else if (data && data.status === 'online') {
      displayStatus = 'Online';
    } else {
      displayStatus = 'Offline';
    }
  }

  // Seamless trigger once the camera is initialized and buffers frames
  const handleCameraReady = useCallback(async (status) => {
    if (status.ready && status.permissionGranted) {
      setErrorMessage(null);
      setAuthState('SCANNING');

      // Add a 350ms camera sensor warmup delay for Chrome / Opera GX auto-exposure
      await new Promise((resolve) => setTimeout(resolve, 350));

      // 1. Capture base64 frame from active feed
      const base64Image = cameraRef.current.capture();
      if (!base64Image) {
        setAuthState('UNKNOWN_USER');
        setErrorMessage("Failed to read frames from camera stream. Please try again.");
        return;
      }

      // 2. Transition state to VERIFYING immediately
      setAuthState('VERIFYING');

      // 3. Execute verify API request using useApi hook
      const result = await verifyFace(base64Image);
      
      if (result.data && result.data.authenticated) {
        setAuthState('SUCCESS');
        
        // Start user session
        login(result.data.user);
        
        // Let the user appreciate the green success animation briefly, then transition
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      } else {
        setAuthState('UNKNOWN_USER');
        setErrorMessage(result.error || "Authentication failed. Face not recognized.");
      }
    }
  }, [navigate, verifyFace, login]);

  const handleCameraError = useCallback((err) => {
    setAuthState('INITIALIZING');
    setErrorMessage(`Webcam Error: ${err.message}. Please click the button below to grant permission.`);
  }, []);

  const handleRetryScan = () => {
    setErrorMessage(null);
    setAuthState('INITIALIZING');
    setCameraKey((prev) => prev + 1);
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
  };

  const isOnline = displayStatus === 'Online';

  return (
    <div style={styles.container}>
      {/* Floating Theme Switcher */}
      <div style={styles.themeToggleWrapper}>
        <ThemeToggle />
      </div>

      <div style={styles.contentWrap}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Surge Suite</h1>
          <p style={styles.subtitle}>Secure facial authentication gateway</p>
        </header>

        <div style={styles.statusBadgeWrap}>
          <span style={{ 
            ...styles.statusDot, 
            backgroundColor: isOnline ? 'var(--status-success)' : 'var(--status-error)' 
          }} />
          <span style={styles.statusText}>Backend: {displayStatus}</span>
        </div>

        {isOnline ? (
          <div style={styles.authWrapper}>
            {/* Headless video capture */}
            <CameraCapture 
              key={cameraKey}
              ref={cameraRef} 
              onReady={handleCameraReady} 
              onError={handleCameraError} 
            />

            {/* FaceID UI Card */}
            <FaceAuthentication state={authState} />

            {/* Error alerts */}
            {errorMessage && (
              <div style={styles.errorAlert}>
                <AlertCircle size={15} style={{ marginRight: '8px', flexShrink: 0 }} />
                {errorMessage}
              </div>
            )}

            {/* Action buttons */}
            <div style={styles.actionContainer}>
              {authState === 'UNKNOWN_USER' && (
                <>
                  <button onClick={handleRetryScan} style={styles.actionBtn}>
                    Try Scan Again
                  </button>
                  <button onClick={handleRegisterRedirect} style={{ ...styles.actionBtn, ...styles.registerBtn }}>
                    Register Face
                  </button>
                </>
              )}

              {errorMessage && authState === 'INITIALIZING' && (
                <button onClick={handleRetryScan} style={styles.actionBtn}>
                  Grant Camera Access
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.offlineCard}>
            <WifiOff size={28} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }} />
            <h3 style={styles.offlineTitle}>Gateway Offline</h3>
            <p style={styles.offlineDesc}>Could not connect to authentication services. Ensure the backend server is running.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-app)',
    padding: 'var(--space-5)',
    transition: 'background var(--dur-normal) var(--ease-apple), color var(--dur-normal) var(--ease-apple)',
    position: 'relative',
  },
  themeToggleWrapper: {
    position: 'absolute',
    top: 'var(--space-5)',
    right: 'var(--space-5)',
  },
  contentWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
    animation: 'fadeIn var(--dur-normal) var(--ease-apple)',
  },
  header: {
    textAlign: 'center',
    marginBottom: 'var(--space-5)',
  },
  headerTitle: {
    fontSize: 'var(--text-2xl)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-1.2px',
    marginBottom: 'var(--space-1)',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  },
  statusBadgeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    padding: '5px 12px',
    borderRadius: 'var(--radius-full)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 'var(--space-6)',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  authWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'var(--space-5)',
    width: '100%',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: 'var(--status-error)',
    padding: '12px var(--space-4)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-xs)',
    lineHeight: '1.5',
  },
  actionContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: 'var(--space-5)',
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    background: 'var(--btn-primary-bg)',
    border: '1px solid var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    padding: '11px var(--space-4)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    transition: 'var(--transition-all)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  registerBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-primary)',
  },
  offlineCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6) var(--space-5)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
  },
  offlineTitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: '700',
    marginBottom: 'var(--space-2)',
    color: 'var(--text-primary)',
  },
  offlineDesc: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  }
};

export default Landing;
