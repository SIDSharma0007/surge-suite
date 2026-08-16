# Database Documentation

This document describes the verified databases and local persistence channels utilized by **Surge Suite** as of Phase 3 workspace configuration.

---

## Persistence Stack Overview

The application utilizes the following persistence models:

| Component | Target Data | Persistence Engine | Location |
| :--- | :--- | :--- | :--- |
| **Django Framework** | Users, Workspaces, Memberships, relational data | PostgreSQL | Configured via `DATABASE_URL` / `DB_*` variables |
| **Face authentication (Primary)** | Face profiles (names, embeddings) | MongoDB | Remote cluster or localhost MongoDB |
| **Face authentication (Fallback)** | Face profiles (names, embeddings) | Local JSON files | `backend/authentication/services/registered_faces/` |
| **Productivity Suite (Notes)** | User notes and trash bin notes | Web Storage (localStorage) | Browser-side client |

---

## 1. PostgreSQL Database Configuration

Django stores relational application data in PostgreSQL. SQLite is no longer used, and no runtime SQLite fallback is supported.

### Relational Schema (Phase 3 Updates)
The following tables are implemented in PostgreSQL:

#### A. `workspace_workspace`
- Stores workspace metadata and links each workspace to its canonical owner.
- **Fields**:
  - `id`: `uuid` (Primary Key).
  - `name`: `varchar(255)`.
  - `owner_id`: `integer` (ForeignKey referencing `auth_user.id` on delete CASCADE).
  - `is_archived`: `boolean` (Default: `false`).
  - `created_at` / `updated_at`: `timestamp`.
  - `archived_at` / `scheduled_deletion_at`: `timestamp` (Null unless archived).

#### B. `workspace_workspacemembership`
- Stores additional workspace members (excluding the owner).
- **Fields**:
  - `id`: `bigint` (Primary Key).
  - `workspace_id`: `uuid` (ForeignKey referencing `workspace_workspace.id` on delete CASCADE).
  - `user_id`: `integer` (ForeignKey referencing `auth_user.id` on delete CASCADE).
  - `role`: `varchar(50)` (Choices: `MEMBER`).
  - `created_at`: `timestamp`.
- **Constraints**:
  - `unique_together = ('workspace', 'user')` to block duplicate memberships.

- **Migration Status**: All migrations (`admin`, `auth`, `contenttypes`, `sessions`, `workspace`) are fully applied (`Applying workspace.0001_initial... OK`).

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
- **Format**: Files are named `user_<user_id>.json` containing user details, embeddings (512-element floating-point vector), and metadata.

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
| **workspace data** | PostgreSQL (`workspace_workspace` / `workspace_workspacemembership` tables) | PostgreSQL | Relational containers for data isolation and member access control. | Phase 3 (Implemented) |
| **notes** | Browser `localStorage` (`surge_notes`, `surge_notes_bin`) | NOT IMPLEMENTED | Relational text documents | Phase 4 |
| **tasks/todos** | Unimplemented (Mock interface template) | NOT IMPLEMENTED | Checklist item | Phase 12/Future |
| **facial embeddings** | MongoDB collection `registered_faces` / Local JSON fallback | MongoDB | Storing mathematical face recognition high-dimensional vectors (ArcFace embeddings). | Phase 1 (Boundary set) |
| **authentication metadata** | MongoDB collection `registered_faces` / Local JSON fallback | MongoDB | Authentication metadata (timestamps, device ID) tied to biometric records. | Phase 1 (Boundary set) |
| **RAG data** | Unimplemented (Empty backend app) | NOT IMPLEMENTED | AI knowledge context | Phase 7 |
| **frontend UI state** | Browser `localStorage` (`theme`) | Browser `localStorage` | Client-side styling configuration | Phase 0 |
| **fallback data** | `backend/authentication/services/registered_faces/` | Local JSON files | Development-only fallback if MongoDB is down | Phase 0 |

---

## 6. Technical Debt and Future Relational Targets

- **localStorage Notes & Tasks**: Currently, user notes are stored entirely in client-side browser `localStorage`. This is a significant technical debt because notes are device-bound, unauthenticated, and bypass backend control. This persistence layer will be migrated to Django PostgreSQL REST APIs in Phase 4.
- **Archived Workspace Retention**: Archived workspaces remain stored in PostgreSQL for a 30-day recovery window. A deletion deadline (`scheduled_deletion_at`) is calculated server-side, after which they are permanently purged from PostgreSQL via the `purge_archived_workspaces` management command.
