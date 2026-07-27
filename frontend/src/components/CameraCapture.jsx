import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const CameraCapture = forwardRef(({ onError, onReady }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const permissionGrantedRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);

  // Keep callback refs updated with the latest function references
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API (getUserMedia) not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        permissionGrantedRef.current = true;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        permissionGrantedRef.current = false;
        console.error("CameraCapture initialization failed:", err);
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.error("Error stopping track:", err);
          }
        });
        streamRef.current = null;
      }
    };
  }, []); // Only run once on mount

  const handleVideoCanPlay = () => {
    if (onReadyRef.current) {
      onReadyRef.current({
        ready: true,
        permissionGranted: permissionGrantedRef.current
      });
    }
  };

  useImperativeHandle(ref, () => ({
    isReady() {
      const video = videoRef.current;
      const ready = !!(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
      return {
        ready,
        permissionGranted: permissionGrantedRef.current
      };
    },
    capture() {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        console.log("[INSTRUMENTATION] CameraCapture.capture() called");
        if (video) {
          console.log(`[INSTRUMENTATION] video.readyState: ${video.readyState}, video.videoWidth: ${video.videoWidth}, video.videoHeight: ${video.videoHeight}`);
        } else {
          console.log("[INSTRUMENTATION] video element is null!");
        }

        if (!video || !canvas) {
          throw new Error("Video or Canvas ref is null during capture.");
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
          throw new Error("Video feed is not ready or has 0 dimensions.");
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("Failed to get 2D canvas context.");
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.85);

        console.log(`[INSTRUMENTATION] Frame captured successfully. Base64 length: ${base64Image.length}`);
        
        // Save to window and localStorage
        window.latestCapturedFrame = base64Image;
        try {
          localStorage.setItem('latestCapturedFrame', base64Image);
          console.log("[INSTRUMENTATION] Saved captured frame to localStorage.");
        } catch (e) {
          console.error("[INSTRUMENTATION] Failed to save frame to localStorage:", e);
        }

        return base64Image;
      } catch (err) {
        console.error("CameraCapture capture failed:", err);
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
        return null;
      }
    }
  }));

  // Render the video and canvas off-screen instead of using display: none.
  // This forces Chromium-based engines (Chrome/Opera GX) to decode and render the video frames.
  return (
    <div style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden', pointerEvents: 'none', top: '-1000px', left: '-1000px' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%' }}
        onCanPlay={handleVideoCanPlay}
      />
      <canvas
        ref={canvasRef}
      />
    </div>
  );
});

CameraCapture.displayName = 'CameraCapture';

export default CameraCapture;
