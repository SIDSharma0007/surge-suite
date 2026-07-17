import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const CameraCapture = forwardRef(({ onError, onReady }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const permissionGrantedRef = useRef(false);

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
        if (onError) {
          onError(err);
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
  }, [onError]);

  const handleVideoCanPlay = () => {
    if (onReady) {
      onReady({
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
        return canvas.toDataURL('image/jpeg', 0.85);
      } catch (err) {
        console.error("CameraCapture capture failed:", err);
        if (onError) {
          onError(err);
        }
        return null;
      }
    }
  }));

  return (
    <div style={{ display: 'none' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
        onCanPlay={handleVideoCanPlay}
      />
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
});


CameraCapture.displayName = 'CameraCapture';

export default CameraCapture;

