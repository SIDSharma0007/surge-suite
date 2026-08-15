# Security Posture Documentation

This document describes the security design, boundaries, and current vulnerabilities in **Surge Suite** as of Phase 2.

---

## Security Boundaries & Topology

```
[ Client Side: Web Browser ]
      |
      |   (Raw Base64 Images)
      |   Session cookies / CSRF token headers sent automatically
      v
[ HTTP Request Boundary ]
      |   Explicit CORS Allowed Origins & CSRF Trusted Origins
      |   CORS Credentials Allowed
      v
[ Backend Core: Django & DRF ]
      |   Session validation using request.user (exclusively server-derived)
      v
[ Authentication Services ]
      |   Usernames resolved deterministically using UUIDs
      |   Face embeddings stored in plaintext
      v
[ Databases: MongoDB Atlas / Local JSON ]
```

---

## 1. Identity & Session Authentication

- **Biometric Recognition & Identity Resolution**: Biometric face profiles map to standard Django `User` model instances.
  - **Biometric user_id → exact Django User.username match**: Every verified biometric credential resolves to a unique, deterministic Django User with `username = user_id` (a UUID string). The user's name is stored separately as display information (`first_name`).
  - No name-based matching or identity guessing is performed. Legacy biometric profiles without a matching Django User are treated as explicit unlinked legacy profiles and rejected.
- **Server-Side Session**: Success in `verify_face_api` triggers `django.contrib.auth.login(request, user)` on the server side, establishing an authoritative session cookie.
- **Client Route Protection**: The frontend caches session user information for UI purposes in `localStorage` under `surge_session`. However, the security authority is exclusively server-derived: the backend verifies all requests via `request.user` session validation.

---

## 2. Secrets & Configuration Management

- **Django Settings Key**: The Django `SECRET_KEY` is loaded from the environment using `python-decouple`. The hardcoded fallback default string is removed.
- **Environment Isolation**: `.env` is ignored by Git, ensuring local secrets are not checked in. If the environment is missing `SECRET_KEY`, the server will fail to start.

---

## 3. Biometric & Data Privacy

- **Biometric Storage**: Facial recognition embeddings (512-dimension vectors) are stored in plaintext JSON documents or MongoDB collections alongside user metadata. This represents a privacy hazard (biometric vector exposure) and is documented as **security debt** to be resolved in a later phase.
- **Vulnerability**: Plaintext embeddings can theoretically be utilized to reconstruct facial landmarks or reverse-engineer biometric details.
- **Data Constraints**: Raw images are NOT retained by the system. Biometric records contain user-identifying metadata (timestamps, name, device ID) alongside embeddings.

---

## 4. CORS & CSRF Configuration

- **CORS Setup**: Enabled using `django-cors-headers` middleware with credentials support (`CORS_ALLOW_CREDENTIALS = True`).
- **Access Control**: Origins are read from the `CORS_ALLOWED_ORIGINS` environment config. Wildcard CORS is not permitted.
- **CSRF Protection**: CSRF checks remain active. The status endpoint (`/api/v1/auth/status/`) is decorated with `@ensure_csrf_cookie` to set the CSRF cookie on initial load.
- **Axios config**: Frontend Axios client is configured with `withCredentials: true`, `xsrfCookieName: 'csrftoken'`, and `xsrfHeaderName: 'X-CSRFToken'` to automatically attach session and CSRF tokens to state-modifying requests.

---

## Security Debt & Future Targets (Phase 3+)

### Identified Security Debt:
1. **Plaintext Biometric Storage**: arcface face embeddings are stored in plaintext in the database/files.
2. **PostgreSQL Connection**: Tests requiring PostgreSQL are blocked locally, meaning relational session state verification tests must run in environments with PostgreSQL.

### Phase 3+ Responsibilities:
1. **Workspace Authorization (Phase 3)**: Implement fine-grained workspace permissions and membership checks.
2. **Biometric Security Hardening (Phase 12/Future)**: Encrypt facial embedding arrays at rest and implement salt/hash checks on computed vectors.
