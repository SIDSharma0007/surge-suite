import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { authServices } from '../services/authServices';
import CameraCapture from '../components/CameraCapture';
import FaceAuthentication from '../components/FaceAuthentication';

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
    <div style={styles.pageContainer}>
      {/* Invisible video hardware controller */}
      <CameraCapture 
        key={cameraKey}
        ref={cameraRef} 
        onReady={handleCameraReady} 
        onError={handleCameraError} 
      />

      {/* Centered card interface */}
      <div style={styles.cardWrapper}>
        <FaceAuthentication state={authState} />

        {authState === 'READY' && (
          <form onSubmit={handleRegister} style={styles.formContainer}>
            <input
              type="text"
              placeholder="Enter Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.textInput}
              required
            />
            <button type="submit" style={styles.submitBtn}>
              Register Biometric Profile
            </button>
          </form>
        )}
      </div>

      {errorMessage && (
        <div style={styles.errorAlert}>
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
  );
}

// Styling parameters
const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
    padding: '24px',
    fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
    overflow: 'hidden'
  },
  cardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '380px'
  },
  textInput: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    textAlign: 'center'
  },
  submitBtn: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    color: '#10b981',
    padding: '12px',
    borderRadius: '12px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  errorAlert: {
    marginTop: '24px',
    maxWidth: '380px',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#ef4444',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    textAlign: 'center',
    lineHeight: '1.4'
  },
  actionContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    width: '100%',
    maxWidth: '380px',
    justifyContent: 'center'
  },
  actionBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  loginBtn: {
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    color: '#3b82f6'
  }
};
