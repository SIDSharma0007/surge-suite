import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { authServices } from '../services/authServices';
import CameraCapture from '../components/CameraCapture';
import FaceAuthentication from '../components/FaceAuthentication';

export default function Login() {
  const cameraRef = useRef(null);
  const navigate = useNavigate();

  // Internal flow states: INITIALIZING, SCANNING, VERIFYING, SUCCESS, UNKNOWN_USER
  const [authState, setAuthState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState(null);
  
  // React key trick to force-remount CameraCapture when retrying access
  const [cameraKey, setCameraKey] = useState(0);

  // Hook for handling the face verification request
  const { execute: verifyFace } = useApi(authServices.verify);

  // Seamless trigger once the camera is initialized and buffers frames
  const handleCameraReady = async (status) => {
    if (status.ready && status.permissionGranted) {
      setErrorMessage(null);
      setAuthState('SCANNING');

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
        
        // Let the user appreciate the green success animation briefly, then transition
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      } else {
        setAuthState('UNKNOWN_USER');
        setErrorMessage(result.error || "Authentication failed. Face not recognized.");
      }
    }
  };


  const handleCameraError = (err) => {
    setAuthState('INITIALIZING');
    setErrorMessage(`Webcam Error: ${err.message}. Please click the button below to grant permission.`);
  };

  const handleRetryScan = () => {
    setErrorMessage(null);
    setAuthState('INITIALIZING');
    // Incrementing key forces CameraCapture to remount and request access again
    setCameraKey((prev) => prev + 1);
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
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

      {/* Futuristic centered biometric UI card */}
      <FaceAuthentication state={authState} />

      {/* Event-driven alert alerts and user recovery controls */}
      {errorMessage && (
        <div style={styles.errorAlert}>
          {errorMessage}
        </div>
      )}

      <div style={styles.actionContainer}>
        {authState === 'UNKNOWN_USER' && (
          <>
            <button onClick={handleRetryScan} style={styles.actionBtn}>
              Try Scan Again
            </button>
            <button onClick={handleRegisterRedirect} style={{ ...styles.actionBtn, ...styles.registerBtn }}>
              Register Biometric Profile
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
  );
}

// Centered viewport page wrapper
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
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    color: '#3b82f6',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  registerBtn: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    color: '#10b981'
  }
};
