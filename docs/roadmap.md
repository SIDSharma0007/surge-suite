# SURGE-REARCH-01 Roadmap

This document records the canonical roadmap phases for the **Surge Suite** re-architecture project.

---

## Roadmap Phases

### Phase 0 — Repository Stabilization
- **Description**: Establish repository branch hygiene, clean up accidentally committed secrets/database files, fix broad ignore rules in `.gitignore`, and document the verified current state architecture.

### Phase 1 — Database Foundation
- **Description**: Establish PostgreSQL as the core relational database. Setup models and migrations in Django for Users, Workspaces, and Notes. Migrate productivity components from localStorage to relational database.

### Phase 2 — Identity & Security Foundation
- **Description**: Harden facial recognition authentication. Implement secure session cookies/JWT tokens, API permission controls, and secure biometric data encryption at rest.

### Phase 3 — Workspace Foundation
- **Description**: Implement Workspace containers, workspace isolation, sharing permissions, and custom access control lists.

### Phase 4 — Content Architecture
- **Description**: Build spreadsheet models and rich spreadsheet editors. Implement change tracking, cell dependencies, and content versioning.

### Phase 5 — Backend Architecture
- **Description**: Optimize backend API views, setup database indexing, configure Redis caching, and implement background worker queues for media/RAG indexing.

### Phase 6 — Frontend Architecture
- **Description**: Refactor the React interface. Harden style architectures, replace vanilla CSS blocks with structured components, and optimize rendering speed.

### Phase 7 — Knowledge / RAG Architecture
- **Description**: Create the Retrieval-Augmented Generation (RAG) system. Set up embedding ingestion for documents and notes, configure a vector database, and build semantic search endpoints.

### Phase 8 — Surge Actions Architecture
- **Description**: Establish user automation actions. Build event listeners, triggers, custom actions, and webhooks execution.

### Phase 9 — MCP / Integration Architecture
- **Description**: Integrate the Model Context Protocol (MCP). Enable external applications to securely connect, read, and write workspace data.

### Phase 10 — Agent Security Architecture
- **Description**: Design safety guardrails for AI agents operating on user workspace data. Implement audit logs, rate limits, and confirmation dialog boundaries.

### Phase 11 — Observability & Reliability
- **Description**: Integrate health telemetry, central logging, error tracking metrics, and alert triggers.

### Phase 12 — Testing Architecture
- **Description**: Expand testing coverage to include backend unit/integration tests and frontend end-to-end user path testing.

### Phase 13 — Deployment Architecture
- **Description**: Create multi-environment staging/production pipelines using Docker container orchestration and automated CI/CD workflows.
