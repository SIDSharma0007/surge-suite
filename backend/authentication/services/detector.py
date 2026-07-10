from deepface import DeepFace as dfc
from . import config

def detect_faces(img, model_name=config.FACE_MODEL, enforce_detection=False):
    """
    Tries to represent/detect faces in an image using a fallback chain:
    defined in config.DETECTOR_PRIORITY.
    
    Returns:
        list of dict: Face representation dictionaries containing embeddings and box coordinates.
    """
    for backend in config.DETECTOR_PRIORITY:
        try:
            representations = dfc.represent(
                img_path=img,
                model_name=model_name,
                enforce_detection=enforce_detection,
                detector_backend=backend
            )
            if representations:
                return representations
        except Exception:
            continue
    return []
