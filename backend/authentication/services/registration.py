from .database import FaceDatabase

# Initialize a globally shared FaceDatabase connection instance
db = FaceDatabase()

def register_face(name, embedding, user_id=None, device_id=None, extra_metadata=None):
    """
    Registers a new face with embedding and metadata.
    
    Args:
        name (str): Person's name.
        embedding (list): Embedding vector.
        user_id (str, optional): Unique user identifier.
        device_id (str, optional): Hardware device identifier.
        extra_metadata (dict, optional): Custom fields.
        
    Returns:
        dict: The created face document dictionary, or None if save failed.
    """
    return db.add_face(
        name=name,
        embedding=embedding,
        user_id=user_id,
        device_id=device_id,
        extra_metadata=extra_metadata
    )

def load_all_faces():
    """
    Retrieves all registered faces from active database.
    
    Returns:
        list of dict: List of face records.
    """
    return db.load_faces()

def update_login_timestamp(user_id):
    """
    Updates the last_login date field for a user in the database.
    
    Args:
        user_id (str): User identifier.
        
    Returns:
        bool: True if updated successfully.
    """
    return db.update_last_login(user_id)
