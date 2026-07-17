import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { authServices } from '../services/authServices';
import CameraCapture from '../components/CameraCapture';
import FaceAuthentication from '../components/FaceAuthentication';
import ThemeToggle from '../components/ThemeToggle';
import { AlertCircle } from 'lucide-react';

export default function Register() {
  const cameraRef = useRef(null);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [authState, setAuthState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState(null);
  
  // React key trick to force-remount CameraCapture when retrying access
  const [cameraKey, setCameraKey] = useState(0);

  // Hook for handling the face registration request
  const { execute: registerFace } = useApi(authServices.register);

  // Synchronize initial camera load state with presentational UI
  const handleCameraReady = (status) => {
    if (status.ready && status.permissionGranted) {
      setErrorMessage(null);
      setAuthState('READY');
    }
  };

  const handleCameraError = (err) => {
    setAuthState('INITIALIZING');
    setErrorMessage(`Webcam Error: ${err.message}. Please click the button below to grant permission.`);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Please enter a name before registering.");
      return;
    }

    if (!cameraRef.current) return;
    const status = cameraRef.current.isReady();
    if (!status.ready || !status.permissionGranted) {
      setErrorMessage("Webcam is not initialized yet.");
      return;
    }

    setErrorMessage(null);
    setAuthState('SCANNING');

    // 1. Capture base64 frame from active feed
    const base64Image = cameraRef.current.capture();
    if (!base64Image) {
      setAuthState('READY');
      setErrorMessage("Failed to read frames from camera stream. Please try again.");
      return;
    }

    // 2. Transition state to VERIFYING immediately
    setAuthState('VERIFYING');

    // 3. Execute registration request using useApi hook
    const result = await registerFace(name.trim(), base64Image);
    
    if (result.data && result.data.user_id) {
      setAuthState('SUCCESS');
      
      // Show success animation briefly, then route to login screen
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } else {
      setAuthState('READY');
      setErrorMessage(result.error || "Registration failed. Please check face alignment.");
    }
  };

  const handleRetryScan = () => {
    setErrorMessage(null);
    setAuthState('INITIALIZING');
    setCameraKey((prev) => prev + 1);
  };

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <div style={styles.themeToggleWrapper}>
        <ThemeToggle />
      </div>

      <div style={styles.contentWrap}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Biometric Register</h1>
          <p style={styles.subtitle}>Create a new secure facial profile</p>
        </header>

        {/* Headless video capture */}
        <CameraCapture 
          key={cameraKey}
          ref={cameraRef} 
          onReady={handleCameraReady} 
          onError={handleCameraError} 
        />

        <div style={styles.cardWrapper}>
          <FaceAuthentication state={authState} />

          {authState === 'READY' && (
            <form onSubmit={handleRegister} style={styles.formContainer}>
              <div style={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Enter Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.textInput}
                  required
                />
              </div>
              <button type="submit" style={styles.submitBtn}>
                Register Profile
              </button>
            </form>
          )}
        </div>

        {/* Error alerts */}
        {errorMessage && (
          <div style={styles.errorAlert}>
            <AlertCircle size={15} style={{ marginRight: '8px', flexShrink: 0 }} />
            {errorMessage}
          </div>
        )}

        <div style={styles.actionContainer}>
          {errorMessage && authState === 'INITIALIZING' && (
            <button onClick={handleRetryScan} style={styles.actionBtn}>
              Grant Camera Access
            </button>
          )}
          <button onClick={handleLoginRedirect} style={{ ...styles.actionBtn, ...styles.loginBtn }}>
            Back to Login
          </button>
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
  cardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    gap: '20px'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '360px'
  },
  inputWrapper: {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '12px var(--space-4)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'var(--transition-all)',
    display: 'flex',
    alignItems: 'center',
  },
  textInput: {
    width: '100%',
    fontSize: 'var(--text-sm)',
    outline: 'none',
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    background: 'var(--text-primary)',
    border: '1px solid var(--text-primary)',
    color: 'var(--bg-card)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    outline: 'none',
    boxShadow: 'var(--shadow-sm)',
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
    maxWidth: '360px',
  },
  actionBtn: {
    flex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-secondary)',
    padding: '11px var(--space-lg)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    transition: 'var(--transition-all)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  loginBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-primary)',
  }
};
