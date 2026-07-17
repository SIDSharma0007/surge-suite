# Reusable CameraCapture Component Documentation

The `CameraCapture` component is a lightweight, headless (invisible) React component designed to manage webcam streams, query camera permissions on initialization, and capture video frames as Base64-encoded strings (`data:image/jpeg;base64,...`).

---

## Features
* **Headless (Hidden)**: Renders a completely hidden video stream and canvas feed (`display: 'none'`) so it can be mounted anywhere in the DOM without impacting the UI layout.
* **Component-Managed Lifecycle**: Handles requesting webcam access on mount, and automatically shuts down media tracks, unbinds stream sources, and cleans up refs on unmount.
* **Race Condition Mitigation**: Handles situations where a component is unmounted while the asynchronous `getUserMedia` camera permission prompt is still pending.
* **Imperative Capture API**: Exposes a clean, direct `capture()` method and `isReady()` status query to parent components using React's `forwardRef` and `useImperativeHandle` hooks.

---

## Component API

### Props
| Prop Name | Type | Description |
| :--- | :--- | :--- |
| `onError` | `function (optional)` | Callback triggered when webcam initialization fails (e.g., permission denied, media API not supported) or when a frame capture fails. |

### Ref Methods
| Method Name | Return Type | Description |
| :--- | :--- | :--- |
| `isReady()` | `object` | Returns the readiness metadata in the format: `{ ready: boolean, permissionGranted: boolean }`. |
| `capture()` | `string \| null` | Draws the current video frame onto a canvas and returns a Base64-encoded Jpeg string (`data:image/jpeg;base64,...`). Returns `null` if the stream is not ready, refs are missing, or canvas context fails. |

---

## Usage Example

### Basic Integration

```jsx
import React, { useRef, useState } from 'react';
import CameraCapture from './components/CameraCapture';

function FaceAuthScreen() {
  const cameraRef = useRef(null);
  const [error, setError] = useState(null);

  const handleCapture = () => {
    if (cameraRef.current) {
      const status = cameraRef.current.isReady();
      
      if (!status.permissionGranted) {
        setError("Camera permission has not been granted.");
        return;
      }
      
      if (!status.ready) {
        setError("Camera feed is not ready yet.");
        return;
      }

      const base64Image = cameraRef.current.capture();
      if (base64Image) {
        console.log("Captured image data:", base64Image);
        // Send base64Image to POST /api/v1/auth/verify/ or /register/
      } else {
        setError("Could not capture frame. Ensure camera is loaded.");
      }
    }
  };

  const handleCameraError = (err) => {
    setError(`Webcam error: ${err.message}`);
  };

  return (
    <div className="auth-container">
      <h2>Verify Identity</h2>
      
      {error && <div className="error-alert">{error}</div>}
      
      <button onClick={handleCapture} className="btn-primary">
        Verify Face
      </button>

      {/* Renders invisibly, requesting permission on mount */}
      <CameraCapture ref={cameraRef} onError={handleCameraError} />
    </div>
  );
}

export default FaceAuthScreen;
```
