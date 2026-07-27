from .embedding import get_face_embeddings
from .verifier import find_best_match
from .registration import register_face, load_all_faces, update_login_timestamp

def register_face_from_image(name, img, user_id=None, device_id=None, extra_metadata=None):
    """
    Orchestrates the business logic of registering a new face from a decoded image matrix.
    
    Args:
        name (str): The name of the user.
        img (numpy.ndarray): The decoded OpenCV image array.
        user_id (str, optional): Custom user ID.
        device_id (str, optional): Device ID.
        extra_metadata (dict, optional): Custom metadata fields.
        
    Returns:
        tuple: (registered_record, error_message)
    """
    if img is None:
        print("[INSTRUMENTATION] register_face_from_image failed: img is None.")
        return None, "Invalid image data."
        
    try:
        faces = get_face_embeddings(img)
    except Exception as e:
        print(f"[INSTRUMENTATION] register_face_from_image failed: Exception during get_face_embeddings: {str(e)}")
        return None, f"Face detection failed: {str(e)}"
        
    if not faces:
        print("[INSTRUMENTATION] register_face_from_image failed: No face detected in the image.")
        return None, "No face detected in image."
    if len(faces) > 1:
        print(f"[INSTRUMENTATION] register_face_from_image failed: Multiple faces detected: {len(faces)}")
        return None, "Multiple faces detected in image. Please ensure only one face is visible."
        
    embedding = faces[0]['embedding']
    
    # Check for duplicate registration
    all_faces = load_all_faces()
    print(f"[INSTRUMENTATION] Checking duplicate registration against {len(all_faces)} registered faces.")
    existing = find_best_match(embedding, all_faces)
    if existing["is_match"]:
        print(f"[INSTRUMENTATION] register_face_from_image failed: Duplicate face with {existing['name']} (distance/score: {existing.get('distance')})")
        return None, f"Face already registered under user: {existing['name']}."
        
    # Save face embedding to MongoDB/JSON fallback
    record = register_face(
        name=name,
        embedding=embedding,
        user_id=user_id,
        device_id=device_id,
        extra_metadata=extra_metadata
    )
    
    if not record:
        print("[INSTRUMENTATION] register_face_from_image failed: Failed to write to DB.")
        return None, "Failed to save face record to the database."
        
    print(f"[INSTRUMENTATION] register_face_from_image succeeded for {name}.")
    return record, None

def verify_face_from_image(img, device_id=None):
    """
    Orchestrates the verification of a face from a decoded image matrix.
    
    Args:
        img (numpy.ndarray): The decoded OpenCV image array.
        device_id (str, optional): Device ID.
        
    Returns:
        dict: Standard result dictionary conforming to success/failure structure.
    """
    if img is None:
        print("[INSTRUMENTATION] verify_face_from_image failed: img is None.")
        return {
            "authenticated": False,
            "reason": "Invalid image data."
        }
        
    try:
        faces = get_face_embeddings(img)
    except Exception as e:
        print(f"[INSTRUMENTATION] verify_face_from_image failed: Exception during get_face_embeddings: {str(e)}")
        return {
            "authenticated": False,
            "reason": f"Face detection failed: {str(e)}"
        }
        
    if not faces:
        print("[INSTRUMENTATION] verify_face_from_image failed: No face detected in the image.")
        return {
            "authenticated": False,
            "reason": "Face not recognized"
        }
        
    embedding = faces[0]['embedding']
    
    # Load all registered faces
    registered_faces = load_all_faces()
    print(f"[INSTRUMENTATION] Loaded {len(registered_faces)} registered faces for matching.")
    
    # Find closest match
    match_result = find_best_match(embedding, registered_faces)
    print(f"[INSTRUMENTATION] Verification match result: {match_result}")
    
    if match_result['is_match']:
        # Update user's login timestamp
        update_login_timestamp(match_result['user_id'])
        print(f"[INSTRUMENTATION] verify_face_from_image succeeded for user {match_result['name']} (ID: {match_result['user_id']}).")
        return {
            "authenticated": True,
            "user": {
                "user_id": match_result['user_id'],
                "name": match_result['name']
            }
        }
    else:
        print(f"[INSTRUMENTATION] verify_face_from_image failed: Face not recognized. Best distance: {match_result.get('distance')}")
        return {
            "authenticated": False,
            "reason": "Face not recognized"
        }
