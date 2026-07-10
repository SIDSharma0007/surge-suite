"""
Face Recognition Configuration
"""

# ==========================
# Recognition Model
# ==========================

FACE_MODEL = "ArcFace"

# ==========================
# Detection Backends
# ==========================

DETECTOR_PRIORITY = [
    "mtcnn",
    "ssd",
    "opencv",
    "retinaface"
]

# ==========================
# Recognition
# ==========================

FACE_MATCH_THRESHOLD = 0.68

FACE_DETECTION_CONFIDENCE = 0.50

# ==========================
# Camera
# ==========================

CAMERA_INDEX = 0

CAMERA_WIDTH = 1280

CAMERA_HEIGHT = 720

PROCESSING_WIDTH = 640

# ==========================
# Performance
# ==========================

FRAME_THREAD_SLEEP = 0.01

REGISTRATION_SLEEP = 0.10

# ==========================
# Face Database
# ==========================

JSON_DATABASE = "registered_faces"

DEFAULT_REFERENCE_NAME = "Reference Face"

# ==========================
# UI
# ==========================

MATCH_COLOR = (0, 255, 0)

UNKNOWN_COLOR = (0, 0, 255)

REGISTERING_COLOR = (0, 255, 255)

FONT_SCALE = 0.6

FONT_THICKNESS = 2

BOX_THICKNESS = 2

REGISTERING_BOX_THICKNESS = 3

# ==========================
# Verification
# ==========================

COSINE_MIN_DISTANCE = 1.0
