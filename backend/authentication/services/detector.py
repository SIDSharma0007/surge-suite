from deepface import DeepFace as dfc
from . import config

def detect_faces(img, model_name=config.FACE_MODEL, enforce_detection=False):
    """
    Tries to represent/detect faces in an image using a fallback chain:
    defined in config.DETECTOR_PRIORITY.
    
    Returns:
        list of dict: Face representation dictionaries containing embeddings and box coordinates.
    """
    print(f"[INSTRUMENTATION] detect_faces() starting. Detector priority: {config.DETECTOR_PRIORITY}")
    for backend in config.DETECTOR_PRIORITY:
        try:
            print(f"[INSTRUMENTATION] Trying detector backend: {backend}")
            representations = dfc.represent(
                img_path=img,
                model_name=model_name,
                enforce_detection=enforce_detection,
                detector_backend=backend
            )
            if representations:
                print(f"[INSTRUMENTATION] Backend '{backend}' succeeded! Detected {len(representations)} faces.")
                for i, rep in enumerate(representations):
                    print(f"  Face {i}: Area: {rep.get('facial_area')}, Confidence: {rep.get('face_confidence')}")
                return representations
        except Exception as e:
            print(f"[INSTRUMENTATION] Backend '{backend}' failed with error: {str(e)}")
            continue
    print("[INSTRUMENTATION] All detector backends failed to find a face.")
    return []
