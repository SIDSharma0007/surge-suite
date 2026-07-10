import base64
import numpy as np
import cv2

def decode_base64_image(base64_str):
    """
    Decodes a base64 image string into an OpenCV image array (numpy matrix).
    Supports format strings with or without headers (e.g., 'data:image/jpeg;base64,...').
    
    Returns:
        numpy.ndarray: Decoded OpenCV image matrix, or None if decoding fails.
    """
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Error decoding base64 image: {e}")
        return None
