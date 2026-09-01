import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { authServices } from '../services/authServices';
import { useAuth } from '../context/AuthContext';
import CameraCapture from '../components/CameraCapture';
import FaceAuthentication from '../components/FaceAuthentication';
import ThemeToggle from '../components/ThemeToggle';
import { AlertCircle } from 'lucide-react';

export default function Login() {
  const cameraRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Internal flow states: INITIALIZING, SCANNING, VERIFYING, SUCCESS, UNKNOWN_USER
  const [authState, setAuthState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState(null);
  
  // React key trick to force-remount CameraCapture when retrying access
  const [cameraKey, setCameraKey] = useState(0);

  // Hook for handling the face verification request
  const { execute: verifyFace } = useApi(authServices.verify);

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

  return (
    <div style={styles.container}>
      <div style={styles.themeToggleWrapper}>
        <ThemeToggle />
      </div>

      <div style={styles.contentWrap}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Biometric Login</h1>
          <p style={styles.subtitle}>Unlock your Surge account with Face ID</p>
        </header>

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

        {/* User recovery controls */}
        <div style={styles.actionContainer}>
          {authState === 'UNKNOWN_USER' && (
            <>
              <button onClick={handleRetryScan} style={styles.actionBtn}>
                Try Scan Again
              </button>
              <button onClick={handleRegisterRedirect} style={{ ...styles.actionBtn, ...styles.registerBtn }}>
                Register Profile
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
    marginBottom: 'var(--space-6)',
  },
  headerTitle: {
    fontSize: 'var(--text-2xl)',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-1px',
    marginBottom: 'var(--space-1)',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
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
  }
};
