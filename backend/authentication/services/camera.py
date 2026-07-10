import cv2
import threading
import time
from .embedding import get_face_embeddings
from .verifier import find_best_match
from .registration import load_all_faces
from . import config

# Threading state variables
lock = threading.Lock()
latest_faces = []
frame_to_process = None
original_dimensions = (config.CAMERA_WIDTH, config.CAMERA_HEIGHT)
new_frame_available = False
running = True

def face_verification_worker():
    global latest_faces, frame_to_process, new_frame_available, running, original_dimensions
    
    # Pre-load cache
    registered_faces_cache = load_all_faces()
    last_cache_reload = time.time()
    
    while running:
        current_frame = None
        with lock:
            if new_frame_available:
                current_frame = frame_to_process.copy()
                new_frame_available = False
                
        if current_frame is not None:
            # Periodically reload cache (every 15 seconds) to pick up new registrants
            now = time.time()
            if now - last_cache_reload > 15:
                registered_faces_cache = load_all_faces()
                last_cache_reload = now
                
            try:
                orig_w, orig_h = original_dimensions
                down_h, down_w = current_frame.shape[:2]
                scale_x = orig_w / down_w
                scale_y = orig_h / down_h
                
                # Fetch embeddings and boxes using fallback detector backend
                faces = get_face_embeddings(current_frame)
                processed_faces = []
                
                for face in faces:
                    emb = face['embedding']
                    box = face['box']
                    
                    # Match against database cache
                    match_result = find_best_match(emb, registered_faces_cache)
                    
                    scaled_box = {
                        'x': int(box['x'] * scale_x),
                        'y': int(box['y'] * scale_y),
                        'w': int(box['w'] * scale_x),
                        'h': int(box['h'] * scale_y)
                    }
                    
                    processed_faces.append({
                        'box': scaled_box,
                        'is_match': match_result['is_match'],
                        'distance': match_result['distance'],
                        'name': match_result['name']
                    })
                    
                    # Log unknown faces without blocking terminal inputs
                    if not match_result['is_match']:
                        print(f"[!] UNKNOWN FACE DETECTED! (Distance: {match_result['distance']:.4f}). "
                              "Please register this face via the React web app / API request.")
                
                with lock:
                    latest_faces = processed_faces
            except Exception as e:
                print(f"Worker Error: {e}")
                
        time.sleep(config.FRAME_THREAD_SLEEP)

def run_local_camera():
    global frame_to_process, new_frame_available, running, original_dimensions
    
    video_source = config.CAMERA_INDEX
    cap = cv2.VideoCapture(video_source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAMERA_HEIGHT)
    
    if not cap.isOpened():
        print('Error: Could not open webcam or video file.')
        return
        
    # Start background processing thread
    worker_thread = threading.Thread(target=face_verification_worker, daemon=True)
    worker_thread.start()
    
    print("Starting local video analysis. Press 'q' on the video window to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print('End of video stream or failed to grab frame.')
            break
            
        with lock:
            if not new_frame_available:
                h_orig, w_orig = frame.shape[:2]
                w_target = config.PROCESSING_WIDTH
                h_target = int(h_orig * (w_target / w_orig))
                frame_to_process = cv2.resize(frame, (w_target, h_target))
                original_dimensions = (w_orig, h_orig)
                new_frame_available = True
                
        with lock:
            faces_to_draw = list(latest_faces)
            
        # Draw bounding boxes and names on the frame
        for face in faces_to_draw:
            try:
                box = face['box']
                x, y, w, h = box['x'], box['y'], box['w'], box['h']
                is_match = face['is_match']
                match_distance = face['distance']
                name = face['name']
                
                color = config.MATCH_COLOR if is_match else config.UNKNOWN_COLOR
                label = f'{name} ({1 - match_distance:.2%})' if is_match else 'UNKNOWN'
                
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, config.BOX_THICKNESS)
                cv2.putText(frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, config.FONT_SCALE, color, config.FONT_THICKNESS)
            except Exception as e:
                print(f"Annotation Error: {e}")
                
        cv2.imshow('Face Verification System (Local Preview)', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    running = False
    worker_thread.join(timeout=1.0)
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    run_local_camera()
