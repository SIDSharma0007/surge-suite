# Security Posture Documentation

This document describes the security design, boundaries, and current vulnerabilities in **Surge Suite** as of Phase 3.

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
      |   Explicit 401 unauthorized handling for unauthenticated requests
      v
[ Workspace / Membership Authorization ]
      |   IsWorkspaceOwner (for updates, archives, member modifications)
      |   IsWorkspaceMember (for workspace retrieval)
      |   Row-level lock on User table during workspace creation
      v
[ Authentication Services ]
      |   Usernames resolved deterministically using UUIDs
      |   Face embeddings stored in plaintext
      v
[ Databases: MongoDB Atlas / Local JSON / PostgreSQL ]
```

---

## 1. Identity & Session Authentication

- **Biometric Recognition & Identity Resolution**: Biometric face profiles map to standard Django `User` model instances.
  - **Biometric user_id → exact Django User.username match**: Every verified biometric credential resolves to a unique, deterministic Django User with `username = user_id` (a UUID string). The user's name is stored separately as display information (`first_name`).
  - No name-based matching or identity guessing is performed. Legacy biometric profiles without a matching Django User are treated as explicit unlinked legacy profiles and rejected.
- **Server-Side Session**: Success in `verify_face_api` triggers `django.contrib.auth.login(request, user)` on the server side, establishing an authoritative session cookie.
- **Client Route Protection**: The frontend caches session user information for UI purposes in `localStorage` under `surge_session`. However, the security authority is exclusively server-derived: the backend verifies all requests via `request.user` session validation.
- **Authentication Credentials Validation**: All API endpoints enforce authenticated requests via custom permission checking, returning explicit `401 Unauthorized` responses instead of defaulting to CSRF-based `403 Forbidden` errors for unauthenticated requests.

---

## 2. Workspace Access Control & Isolation

### A. Ownership & Membership Authorization
Fine-grained Django REST Framework permissions are enforced on all workspace resources:
- **`IsWorkspaceOwner`**: Ensures only the creator of the workspace (`Workspace.owner`) can update details, rename the workspace, archive it, or manage its members (adding/removing).
- **`IsWorkspaceMember`**: Ensures only the owner OR members registered in `WorkspaceMembership` can retrieve details or access contents.
- **Archive Isolation**: Once a workspace is archived, retrieve and update operations are strictly blocked with `403 Forbidden` responses. Restoration and management can only be initiated by the owner.

### B. Workspace Limits & Concurrency Locking
- Each user is limited to a maximum of **5 owned workspaces** (including archived ones).
- Concurrent workspace creation requests are serialized using PostgreSQL row-level locks on the user row:
  `User.objects.select_for_update().get(id=user.id)`
  This prevents race conditions where double-submitted or concurrent requests could bypass the limit checks and provision more than 5 workspaces.

---

## 3. Secrets & Configuration Management

- **Django Settings Key**: The Django `SECRET_KEY` is loaded from the environment using `python-decouple`. The hardcoded fallback default string is removed.
- **Environment Isolation**: `.env` is ignored by Git, ensuring local secrets are not checked in. If the environment is missing `SECRET_KEY`, the server will fail to start.

---

## 4. Biometric & Data Privacy

- **Biometric Storage**: Facial recognition embeddings (512-dimension vectors) are stored in plaintext JSON documents or MongoDB collections alongside user metadata. This represents a privacy hazard (biometric vector exposure) and is documented as **security debt** to be resolved in a later phase.
- **Vulnerability**: Plaintext embeddings can theoretically be utilized to reconstruct facial landmarks or reverse-engineer biometric details.
- **Data Constraints**: Raw images are NOT retained by the system. Biometric records contain user-identifying metadata (timestamps, name, device ID) alongside embeddings.

---

## 5. CORS & CSRF Configuration

- **CORS Setup**: Enabled using `django-cors-headers` middleware with credentials support (`CORS_ALLOW_CREDENTIALS = True`).
- **Access Control**: Origins are read from the `CORS_ALLOWED_ORIGINS` environment config. Wildcard CORS is not permitted.
- **CSRF Protection**: CSRF checks remain active. The status endpoint (`/api/v1/auth/status/`) is decorated with `@ensure_csrf_cookie` to set the CSRF cookie on initial load.
- **Axios config**: Frontend Axios client is configured with `withCredentials: true`, `xsrfCookieName: 'csrftoken'`, and `xsrfHeaderName: 'X-CSRFToken'` to automatically attach session and CSRF tokens to state-modifying requests.

---

## Security Debt & Future Targets (Phase 4+)

### Identified Security Debt:
1. **Plaintext Biometric Storage**: ArcFace face embeddings are stored in plaintext in the database/files.
2. **PostgreSQL Connection**: Tests requiring PostgreSQL are blocked locally, meaning relational session state verification tests must run in environments with PostgreSQL.

### Phase 4+ Responsibilities:
1. **Workspace Resource Access Control (Phase 4)**: Ensure that resources like Notes are scoped correctly and validated against the workspace context, inheriting active workspace authorization boundaries.
2. **Biometric Security Hardening (Phase 12/Future)**: Encrypt facial embedding arrays at rest and implement salt/hash checks on computed vectors.
