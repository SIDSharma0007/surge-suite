# Net Summary of Changes - Facial Authentication Integration

This document outlines the changes implemented to integrate the face recognition system with the Django backend and Vite/React frontend.

---

## 1. API Architecture, Versioning, and Routing
* **Namespace Versioning**: Versioned all backend endpoints under the `/api/v1/` namespace (updated `backend/config/urls.py`).
* **App-Level Routes**: Created `backend/authentication/urls.py` and mapped:
  * `POST /api/v1/auth/register/` $\rightarrow$ Registers new faces.
  * `POST /api/v1/auth/verify/` $\rightarrow$ Verifies and logs in users via facial matching.
  * `GET /api/v1/auth/status/` $\rightarrow$ Checks API status and returns total registered faces count.

---

## 2. Django REST API & Serializer Contracts
* **Request/Response Validation**: Created `backend/authentication/serializers.py` to manage input validations and output formatting.
* **Strict Response Contract**: Configured verification to respond with the exact JSON contracts:
  * *On Success:* 
    ```json
    {
        "authenticated": true,
        "user": {
            "id": "...",
            "name": "..."
        }
    }
    ```
  * *On Failure:* 
    ```json
    {
        "authenticated": false,
        "reason": "..."
    }
    ```
  * Embeddings, MongoDB object keys (`_id`), and raw database fields are safely stripped from all client responses.
* **Thin Controllers**: Overwrote `backend/authentication/views.py` to keep views extremely thin and free of face detection, OpenCV operations, or database logic.

---

## 3. Face Verification Service Engine Refactoring
Decomposed the monolithic `faces_engine.py` into modular, isolated files under `backend/authentication/services/`:
* **config.py**: Centralizes all hyperparameters (model names, detection backend fallback order, matching/confidence thresholds, and camera processing resolutions/sleep durations).
* **auth_service.py**: Orchestrates the business workflow of verifying and registering users from decoded image matrices. Integrates a duplicate face registration check via `find_best_match` before saving.
* **detector.py**: Implements the sequential fallback detection chain (`mtcnn` $\rightarrow$ `ssd` $\rightarrow$ `opencv` $\rightarrow$ `retinaface`).
* **embedding.py**: Extracts 512-dimension spatial vectors for detected faces.
* **verifier.py**: Calculates cosine distance and performs matching.
* **database.py**: The single module reading/writing database records (supporting MongoDB with local JSON directory fallbacks under `config.FACE_COLLECTION`).
* **registration.py**: Wraps helper functions to save, load, and query face database records.
* **camera.py**: Drives the local OpenCV camera loop using a background thread.
* **utils.py** (in `backend/authentication/`): Exposes `decode_base64_image(base64_str)` to handle input conversions outside the service or API routes.

---

## 4. Configuration and Environment Management
* **Environment Files**: Generated `.env.example` templates for both `frontend/` and `backend/` and added `.env` to `.gitignore`.
* **Decoupled Settings**: Configured `backend/config/settings.py` and `backend/authentication/services/database.py` using `python-decouple` to retrieve secrets, debug mode, MongoDB URIs, and database names.
* **Frontend Config**: Updated the React `VITE_API_URL` to match `/api/v1`.

---

## 5. Frontend & Status Integration
* **Axios API Client**: Built `frontend/src/services/api.js` to configure baseline axios request and response interceptors.
* **Custom useApi Hook**: Added `frontend/src/hooks/useApi.js` for handling API query states, errors, loading flags, and status triggers.
* **Status Checker**: Updated `frontend/src/pages/Landing.jsx` to automatically fetch, cache, and display live database status connections.

---

## 6. Biometric Pages & Camera Integration
* **Camera Hardware Sync**: Updated `CameraCapture.jsx` to support an `onReady` prop triggered reactively by the HTML5 video `onCanPlay` event.
* **Biometric Authentication UI**: Created `FaceAuthentication.jsx` and `FaceAuthentication.css` with rotating, pulsing, and sweeping HUD layouts representing `INITIALIZING`, `READY`, `SCANNING`, `VERIFYING`, `SUCCESS`, and `UNKNOWN_USER`.
* **Single Source of Truth (Axios Services)**:
  * Created `authServices.js` containing `register`, `verify`, and `status` functions to completely isolate components from Axios endpoints.
  * Refactored `Login.jsx` to use `useApi` in tandem with `authServices.verify` to control scanning states and verification redirects.
  * Refactored `Register.jsx` to use `useApi` in tandem with `authServices.register` to manage user biometric profiles saving.

---

## 7. Dependency Installation & Compilation
* Downgraded `numpy` to `1.26.4` to fix Cython build incompatibilities and installed `deepface` and `tf-keras`.
* Verified clean production asset compilation using `npm run build` (compiled in 999ms with no errors).
