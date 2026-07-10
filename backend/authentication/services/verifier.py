import numpy as np
from . import config

def calculate_cosine_distance(a, b):
    """
    Calculates the cosine distance between two embedding vectors.
    
    Returns:
        float: Cosine distance value between 0 and 2.
    """
    a = np.array(a)
    b = np.array(b)
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return config.COSINE_MIN_DISTANCE
    return 1 - (dot_product / (norm_a * norm_b))

def find_best_match(current_embedding, registered_faces, threshold=None):
    """
    Compares a target embedding against a list of registered faces to find the closest match.
    
    Args:
        current_embedding (list): Embedding vector to identify.
        registered_faces (list): List of registered face dicts loaded from database.
        threshold (float, optional): Match threshold (defaults to config.FACE_MATCH_THRESHOLD).
        
    Returns:
        dict: Match results containing name, user_id, distance, and is_match flags.
    """
    if threshold is None:
        threshold = config.FACE_MATCH_THRESHOLD
        
    best_match_name = "UNKNOWN"
    best_match_id = None
    min_distance = config.COSINE_MIN_DISTANCE
    
    for reg_face in registered_faces:
        dist = calculate_cosine_distance(reg_face['embedding'], current_embedding)
        if dist < min_distance:
            min_distance = dist
            best_match_name = reg_face.get('name', 'UNKNOWN')
            best_match_id = reg_face.get('user_id')
            
    is_match = min_distance < threshold
    return {
        'name': best_match_name if is_match else "UNKNOWN",
        'user_id': best_match_id if is_match else None,
        'distance': min_distance,
        'is_match': is_match
    }
