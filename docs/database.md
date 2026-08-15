# Database Documentation

This document describes the verified databases and local persistence channels utilized by **Surge Suite** as of Phase 0 stabilization.

---

## Persistence Stack Overview

The application utilizes three distinct persistence models:

| Component | Target Data | Persistence Engine | Location |
| :--- | :--- | :--- | :--- |
| **Django Framework** | Authentication, admin schema | SQLite | `backend/db.sqlite3` (Local) |
| **Face authentication (Primary)** | Face profiles (name, embeddings) | MongoDB | Remote cluster or localhost MongoDB |
| **Face authentication (Fallback)** | Face profiles (name, embeddings) | Local JSON files | `backend/authentication/services/registered_faces/` |
| **Productivity Suite (Notes)** | User notes and trash bin notes | Web Storage (localStorage) | Browser-side client |

---

## 1. SQLite Database Configuration

Django is configured to store relational data in SQLite:
```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
```
- **Current State**: Contains standard Django administration schemas. It has no application-specific schema because no model definitions exist inside the backend apps (`users`, `workspace`, `notes`, `todo`, `rag`).
- **Stabilization Note**: The file `backend/db.sqlite3` was previously committed to the repository. It has now been untracked and added to `.gitignore` to prevent database state leaking into git history.

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
- **Stabilization Note**: The legacy file `registered_faces.json` was previously tracked in Git but was unused. It has been untracked and added to `.gitignore` along with the active `registered_faces/` subdirectory.

---

## 4. Notes Web Storage Configuration

User notes are completely decoupled from the Django databases:
- **Storage Channel**: Browser localStorage.
- **Keys**:
  - `surge_notes`: Array of note dicts representing the active workspace.
  - `surge_notes_bin`: Array of note dicts representing notes deleted within 30 days.

---

## Phase 1 Database Work

To transition Surge Suite to a production-ready state, Phase 1 must implement the following database architecture foundations:
1. **Migration to PostgreSQL**: Replace SQLite with PostgreSQL as Django's primary database engine.
2. **Relational Schema Integration**: Translate Notes, Workspaces, and Tasks from ephemeral frontend localStorage/mock states to backend Django models.
3. **Restructure Biometric Persistence**: Move face embeddings and profile metadata into a unified persistence plan, securing them behind access controls (possibly utilizing pgvector in PostgreSQL instead of MongoDB).
4. **Relink API Layer**: Expose secure REST routes on the Django backend for note and folder CRUD.
