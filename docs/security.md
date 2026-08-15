# Security Posture Documentation

This document describes the current security design, configuration, and identified vulnerabilities in **Surge Suite** as of Phase 0 stabilization.

---

## Security Boundaries & Topology

```
[ Client Side: Web Browser ]
      |
      |   (Raw Base64 Images)
      |   No secure token auth / mock validation
      v
[ HTTP Request Boundary ]
      |   CORS Allowed Origins (.env controlled)
      v
[ Backend Core: Django & DRF ]
      |   decouple loads secrets / SECRET_KEY defined in .env
      v
[ Authentication Services ]
      |   Face embeddings stored in plaintext
      v
[ Databases: MongoDB Atlas / Local JSON ]
```

---

## 1. Authentication & Session Security

- **Facial Authentication**: The application implements face-recognition login using base64 image strings transmitted over HTTP `POST` requests.
- **Verification Logic**: Cosine distance similarity verification occurs on the backend using ArcFace embeddings. Match result (`authenticated: True`) returns the user details.
- **Session Handling**: Success response in `verify_face_api` is not followed by any secure token generation (no JWT tokens or backend session cookies are returned or verified).
- **Client Route Protection**: The frontend implements a `ProtectedRoute` component that checks `isAuthenticated` inside the React `AuthContext`. However, this is purely client-side logic and is easily bypassed.

---

## 2. Secrets & Configuration Management

- **Django Settings Key**: The Django `SECRET_KEY` is loaded from the environment using `python-decouple`. The hardcoded fallback default string has been removed.
- **Environment Isolation**: `.env` is ignored by Git, ensuring local secrets are not checked in. If the environment is missing `SECRET_KEY`, the server will fail to start.

---

## 3. Biometric & Data Privacy

- **Biometric Storage**: Facial recognition embeddings (512-dimension vectors) are stored in plaintext JSON documents or MongoDB collections alongside user metadata. This represents a privacy hazard (biometric vector exposure).
- **Vulnerability**: Plaintext embeddings can theoretically be utilized to reconstruct facial landmarks or reverse-engineer biometric details.

---

## 4. CORS & API Security

- **CORS Setup**: Enabled using `django-cors-headers` middleware.
- **Access Control**: Origins are read from the `CORS_ALLOWED_ORIGINS` environment config. Development defaults are configured for standard local web development origins.

---

## Security Weaknesses & Hardening Plan (Phase 2+)

> [!WARNING]
> The current security posture is in a **degraded/demo state** and is not suitable for production deployment.

### Required Security Hardening Tasks:
1. **Implement JWT Token Auth**: Transition authentication from mock state tracking to verified JSON Web Tokens (JWT) issued on verification success and verified via headers on all database CRUD calls.
2. **Secure Biometric Persistence**: Encrypt facial embedding arrays at rest and implement salt/hash checks on computed vectors to prevent raw biometric data leakage.
3. **API Access Control**: Protect backend API endpoints using Django REST framework permissions (`IsAuthenticated`) to block unauthorized CRUD requests.
4. **Rate Limiting**: Add throttle classes to authentication endpoints (`register/`, `verify/`) to mitigate brute-force camera loop attacks.
