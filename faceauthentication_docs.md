# FaceAuthentication Component Documentation

The `FaceAuthentication` component is a high-fidelity, presentational biometric interface designed to indicate face-scanning progress and verification results using pure CSS animations and SVG draw paths.

---

## Supported States
The interface transitions between six primary states based on the supplied `state` prop:

| State Enum | HSL Tone | Accent Hex | Visual Behavior |
| :--- | :--- | :--- | :--- |
| `INITIALIZING` | Gold/Amber | `#f59e0b` | Spinning dashed loading ring. |
| `READY` | Neutral Blue | `#3b82f6` | Stationary frame with breathing outer glow. |
| `SCANNING` | Tech Cyan | `#06b6d4` | Active vertical laser sweep bar (top $\leftrightarrow$ bottom). |
| `VERIFYING` | Deep Purple | `#8b5cf6` | Spinning dashed loading ring at double frequency. |
| `SUCCESS` | Emerald Green | `#10b981` | Animated draw path for a green completion checkmark. |
| `UNKNOWN_USER` | Crimson Red | `#ef4444` | Animated draw path for a red warning cross. |

---

## Sub-Components

### 1. `ScannerAnimation`
* Renders outer HUD corner bracket guides.
* Hosts the pulsing main frame ring.
* Renders a vector background tech grid.
* Alternates between rendering a face silhouette, loading spinner, scanning laser, checkmark, or failure cross depending on the active state.

### 2. `StatusText`
* Renders title and description texts below the scanner frame.

---

## Props

| Prop Name | Type | Description |
| :--- | :--- | :--- |
| `state` | `string` | The active biometric phase. One of: `INITIALIZING`, `READY`, `SCANNING`, `VERIFYING`, `SUCCESS`, or `UNKNOWN_USER`. Defaults to `READY`. |

---

## Event-Driven Integration Example

Here is how you can mount and connect the presentational `FaceAuthentication` component with the `CameraCapture` component. The flow triggers **automatically** once the camera is ready and runs reactively based on live events using the centralized `authServices` and `useApi` hook:

```jsx
import React, { useRef, useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { authServices } from '../services/authServices';
import CameraCapture from './CameraCapture';
import FaceAuthentication from './FaceAuthentication';

function FacialLoginCard() {
  const cameraRef = useRef(null);
  const [authState, setAuthState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  // Unified HTTP Request handler using useApi hook and authServices
  const { execute: verifyFace } = useApi(authServices.verify);

  useEffect(() => {
    let checkInterval = null;
    let isScanning = false;

    // Monitor camera readiness seamlessly
    checkInterval = setInterval(async () => {
      if (!cameraRef.current || isScanning) return;

      const status = cameraRef.current.isReady();

      if (status.ready && status.permissionGranted) {
        clearInterval(checkInterval);
        isScanning = true;
        
        // Camera is ready: Trigger scan and verify loop immediately (no buttons required)
        performSeamlessVerification();
      }
    }, 200); // Check every 200ms

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  const performSeamlessVerification = async () => {
    setAuthState('SCANNING');

    // Capture base64 frame from active feed
    const base64Image = cameraRef.current.capture();
    if (!base64Image) {
      setAuthState('UNKNOWN_USER');
      setErrorMessage("Failed to capture frame from webcam feed.");
      return;
    }

    // Transition to verifying phase immediately
    setAuthState('VERIFYING');

    // Execute verify request using useApi
    const result = await verifyFace(base64Image);

    if (result.data && result.data.authenticated) {
      setAuthState('SUCCESS');
    } else {
      setAuthState('UNKNOWN_USER');
      setErrorMessage(result.error || "Authentication failed. Face not recognized.");
      setNeedsRegistration(true); // Offer registration if face is unknown
    }
  };

  const handleCameraError = (err) => {
    setAuthState('INITIALIZING');
    setErrorMessage(`Webcam error: ${err.message}. Please check permissions.`);
  };

  return (
    <div className="login-page">
      {/* Headless stream capture */}
      <CameraCapture ref={cameraRef} onError={handleCameraError} />

      {/* Futuristic Presentational Interface Card */}
      <FaceAuthentication state={authState} />

      {/* Error or Alert Message overlay */}
      {errorMessage && <div className="error-alert">{errorMessage}</div>}

      {/* Registration Call-To-Action (only shows when registration is needed) */}
      {needsRegistration && (
        <button 
          onClick={() => window.location.href = '/register'} 
          className="registration-btn"
        >
          Create New Biometric Profile
        </button>
      )}
    </div>
  );
}

export default FacialLoginCard;
```
