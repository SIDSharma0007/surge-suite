# Database Documentation

This document describes the verified databases and local persistence channels utilized by **Surge Suite** as of Phase 1 database configuration.

---

## Persistence Stack Overview

The application utilizes three distinct persistence models:

| Component | Target Data | Persistence Engine | Location |
| :--- | :--- | :--- | :--- |
| **Django Framework** | Authentication, relational data | PostgreSQL | Configured via `DATABASE_URL` / `DB_*` variables |
| **Face authentication (Primary)** | Face profiles (names, embeddings) | MongoDB | Remote cluster or localhost MongoDB |
| **Face authentication (Fallback)** | Face profiles (names, embeddings) | Local JSON files | `backend/authentication/services/registered_faces/` |
| **Productivity Suite (Notes)** | User notes and trash bin notes | Web Storage (localStorage) | Browser-side client |

---

## 1. PostgreSQL Database Configuration

Django is configured to store relational application data in PostgreSQL. SQLite is no longer used, and no runtime SQLite fallback is supported.

```python
import urllib.parse

DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    url = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": urllib.parse.unquote(url.path.lstrip("/")),
            "USER": urllib.parse.unquote(url.username or ""),
            "PASSWORD": urllib.parse.unquote(url.password or ""),
            "HOST": urllib.parse.unquote(url.hostname or ""),
            "PORT": url.port or 5432,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="surge_suite"),
            "USER": config("DB_USER", default=""),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432", cast=int),
        }
    }
```

- **Current State**: PostgreSQL driver dependencies are added (`psycopg[binary]==3.3.4`). SQLite is deprecated and fully removed from settings.
- **Migration Status**: Default Django migrations (`admin`, `auth`, `contenttypes`, `sessions`) are configured to execute against the active PostgreSQL database.

---

## 2. MongoDB Database Configuration

MongoDB is the primary database for the face authentication service.
- **Connection Logic**: Defined in `backend/database/connection.py` and `backend/authentication/services/database.py`. It reads connection settings from environment configuration:
  - `MONGO_URI` (default: `mongodb://localhost:27017/`)
  - `DATABASE_NAME` (default: `surge_suite`)
  - `FACE_COLLECTION` (default: `registered_faces`)
- **Developer Setup**: The local `.env` points to a MongoDB Atlas cluster (`Cluster23175` shard group).

---

## 3. Local JSON Fallback Configuration

If the MongoDB client fails to connect or force-ping the cluster, the `FaceDatabase` class (`database.py`) automatically shifts database actions to local JSON storage:
- **Fallback Directory**: `backend/authentication/services/registered_faces/` (subfolder defined dynamically from the collection name).
- **Format**: Files are named `user_<user_id>.json` containing user details, timestamps, active flags, and the 512-element floating-point `embedding` vector.

---

## 4. Notes Web Storage Configuration

User notes are completely decoupled from the Django databases:
- **Storage Channel**: Browser localStorage.
- **Keys**:
  - `surge_notes`: Array of note dicts representing the active workspace.
  - `surge_notes_bin`: Array of note dicts representing notes deleted within 30 days.

---

## 5. Persistence Boundary Matrix

This table lists the current verified storage locations of all entities in the codebase, alongside their intended canonical locations:

| Data | Current Location | Canonical Location | Reason | Phase |
| :--- | :--- | :--- | :--- | :--- |
| **users** | Browser `localStorage` (`surge_session`) & memory context | PostgreSQL (`auth_user` tables) | Django authentication framework utilizes standard relational user records. | Phase 1 (Configured), Phase 2 (Implemented) |
| **workspace data** | Unimplemented (Mock state `[]` in `Dashboard.jsx`) | NOT IMPLEMENTED | Relational container | Phase 3 |
| **notes** | Browser `localStorage` (`surge_notes`, `surge_notes_bin`) | NOT IMPLEMENTED | Relational text documents | Phase 4 |
| **tasks/todos** | Unimplemented (Mock interface template) | NOT IMPLEMENTED | Checklist item | Phase 12/Future |
| **facial embeddings** | MongoDB collection `registered_faces` / Local JSON fallback | MongoDB | Storing mathematical face recognition high-dimensional vectors (ArcFace embeddings). | Phase 1 (Boundary set) |
| **authentication metadata** | MongoDB collection `registered_faces` / Local JSON fallback | MongoDB | Authentication metadata (timestamps, device ID) tied to biometric records. | Phase 1 (Boundary set) |
| **RAG data** | Unimplemented (Empty backend app) | NOT IMPLEMENTED | AI knowledge context | Phase 7 |
| **frontend UI state** | Browser `localStorage` (`theme`) | Browser `localStorage` | Client-side styling configuration | Phase 0 |
| **fallback data** | `backend/authentication/services/registered_faces/` | Local JSON files | Development-only fallback if MongoDB is down | Phase 0 |

---

## 6. Technical Debt and Phase 1 Database Work

- **localStorage Notes & Tasks**: Currently, user notes are stored entirely in client-side browser `localStorage`. This is a significant technical debt because notes are device-bound, unauthenticated, and bypass backend control. This persistence layer will be migrated to Django PostgreSQL REST APIs in Phase 4.
- **SQLite Deprecation**: Relational schema operations are now fully pointed to PostgreSQL. Relational migrations can only be executed against a valid PostgreSQL instance.
