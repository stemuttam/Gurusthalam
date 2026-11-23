
# Gurusthalam Frontend Architecture Baseline

**Status:** APPROVED — FROZEN BASELINE

**Architecture owner:** Gurusthalam Engineering

**Baseline commit:** 99a1bec

## 1. Decision

The Gurusthalam frontend will follow a shared,
feature-oriented, Nx monorepo architecture.

The architecture consists of:

- apps/web
- apps/admin
- libs/frontend
- libs/ui
- libs/design-system

Existing backend applications and domain libraries
will remain independently maintained.

## 2. Application boundaries

### Web

The Web application owns learner-facing and
teacher-facing product experiences.

Its features include:

- Dashboard
- Courses
- Learning
- Question Bank
- Assessments
- Notifications

### Admin

The Admin application owns privileged administrative
experiences.

Its features include:

- Platform
- Institutions
- Users
- Courses
- Question Bank
- Assessments
- Notifications
- Operations
- Settings

## 3. Shared frontend infrastructure

The following libraries are official:

- libs/frontend/api-client
- libs/frontend/auth
- libs/frontend/navigation
- libs/frontend/permissions
- libs/frontend/forms
- libs/frontend/feedback
- libs/frontend/testing

## 4. Shared UI and design system

### libs/ui

Owns reusable React components and interaction logic.

### libs/design-system

Owns:

- Design tokens
- Themes
- Typography
- Visual foundations
- Accessibility foundations
- Shared component styling

## 5. Backend preservation

The following remain backend domain libraries:

- libs/courses
- libs/learning
- libs/question-bank
- libs/assessments
- libs/shared

Frontend applications must not import backend
implementation details into browser bundles.

## 6. Dependency rules

1. Applications may consume approved frontend libraries.
2. UI components may consume design-system foundations.
3. Frontend API clients communicate with the NestJS API.
4. Browser applications never access PostgreSQL directly.
5. Backend authorization remains authoritative.
6. No circular project dependencies.
7. No server secrets in frontend applications.
8. Domain business logic remains in backend domains.

## 7. Technology baseline

The existing technology stack is retained:

- React 19
- TypeScript 6
- Vite 8
- React Router 6
- Nx 23
- pnpm
- Vitest

Additional dependencies require architectural review.

## 8. Architecture change control

This architecture is frozen as the approved
implementation baseline.

Future additions must fit the established boundaries.

Changes to application ownership, library boundaries,
backend separation or primary technology require
explicit architectural review and approval.

## 9. Implementation policy

- Complete files with exact paths.
- Preserve existing functionality.
- No destructive modifications.
- Contract-first API integration.
- Unit, integration and E2E validation.
- Evidence-based production qualification.

## 10. Long-term objective

Build one coherent Education Intelligence Platform
supporting learners, teachers, institutions,
parents and platform administrators.

The frontend and backend will evolve in parallel
without compromising architectural boundaries.
