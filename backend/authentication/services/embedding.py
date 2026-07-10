from .detector import detect_faces
from . import config

def get_face_embeddings(img):
    """
    Detects faces in the image and extracts their embedding vectors and facial areas.
    Filters out detections with confidence <= config.FACE_DETECTION_CONFIDENCE.
    
    Args:
        img: Image array or path to image file.
        
    Returns:
        list of dict: A list of dicts, each with 'embedding' and 'box' keys.
    """
    representations = detect_faces(img)
    results = []
    
    for rep in representations:
        confidence = rep.get('face_confidence')
        if confidence is None:
            confidence = 1.0
            
        if confidence > config.FACE_DETECTION_CONFIDENCE:
            results.append({
                'embedding': rep['embedding'],
                'box': rep['facial_area']
            })
            
    return results
