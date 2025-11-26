<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 → 1.0.0 (MAJOR - initial constitution)
Modified principles: N/A (new)
Added sections:
  - I. KISS (Keep It Simple, Stupid)
  - II. YAGNI (You Aren't Gonna Need It)
  - III. Clean Code
  - Development Standards
  - Quality Gates
  - Governance
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (compatible)
  - .specify/templates/spec-template.md ✅ (compatible)
  - .specify/templates/tasks-template.md ✅ (compatible)
Follow-up TODOs: None
==================
-->

# OHEL YEOCHOUA Constitution

## Core Principles

### I. KISS (Keep It Simple, Stupid)

Every solution MUST be the simplest one that solves the problem. Complexity is a cost
that must be explicitly justified.

**Non-Negotiables:**
- Prefer straightforward solutions over clever abstractions
- One file doing one thing well is better than an over-engineered module system
- If a junior developer cannot understand the code in 5 minutes, it is too complex
- No premature optimization; solve the problem first, optimize only with evidence
- Flat structures over deep nesting

**Rationale:** The donation visualization system must remain maintainable by any
developer. Complex code leads to bugs, slower development, and technical debt that
impedes future enhancements.

### II. YAGNI (You Aren't Gonna Need It)

Implement only what is explicitly required today. Do not build for hypothetical
future requirements.

**Non-Negotiables:**
- No features "just in case" they might be useful
- No abstractions for single use cases
- No configuration for things that could be constants
- No plugins/extensibility unless explicitly requested
- Delete unused code immediately; version control preserves history

**Rationale:** Every line of code is a liability. Unused features increase maintenance
burden, testing surface, and cognitive load without delivering value.

### III. Clean Code

Code MUST be readable, self-documenting, and maintainable. Quality is not optional.

**Non-Negotiables:**
- Meaningful names for variables, functions, and files
- Functions do one thing and do it well
- No magic numbers; use named constants
- Consistent formatting throughout the codebase
- Comments explain "why", not "what" (the code itself shows "what")
- No dead code, no commented-out code blocks
- Error messages must be helpful and actionable

**Rationale:** The admin panel and visualization system will be maintained over time.
Clean code reduces onboarding time, bug rate, and support costs.

## Development Standards

**Technology Recommendations:**
- Frontend: Modern JavaScript/TypeScript framework (Vue.js or React recommended for
  real-time reactivity)
- Backend: Lightweight API (Node.js/Express or Python/FastAPI)
- Real-time: WebSockets or Server-Sent Events for instant updates
- Database: Simple SQLite for MVP, PostgreSQL for production
- SVG: Hand-crafted or Figma-exported for Menorah animation

**Project Structure:**
- Separate admin panel from public visualization displays
- Shared API for both interfaces
- SVG assets in dedicated directory with clear naming

**Code Organization:**
- Group by feature, not by file type when possible
- Keep related files close together
- Avoid deep directory nesting (max 3 levels)

## Quality Gates

**Before Merging Code:**
- Code runs without errors
- Manual testing of affected features completed
- No console errors or warnings in production builds
- Responsive design verified (admin panel on desktop, displays on various screens)

**Testing Approach:**
- Tests are recommended for critical paths (donation processing, amount calculations)
- E2E tests encouraged for core user journeys
- Unit tests optional but welcomed for complex logic
- No strict TDD requirement; practical testing over process dogma

**Performance:**
- Animations must run at 60fps on target display hardware
- Real-time updates must propagate within 1 second
- Admin panel must be responsive and snappy

## Governance

**Constitution Authority:**
This constitution supersedes all other practices. When in doubt, defer to the three
core principles in order: KISS → YAGNI → Clean Code.

**Amendment Process:**
1. Document the proposed change and rationale
2. Verify the change aligns with core principles
3. Update this constitution with new version number
4. Update affected templates if necessary

**Versioning Policy:**
- MAJOR: Principle changes or removals
- MINOR: New sections or expanded guidance
- PATCH: Clarifications and typo fixes

**Compliance:**
- All code reviews must verify alignment with core principles
- Complexity must be explicitly justified with a comment or PR description
- When principles conflict, KISS takes precedence

**Version**: 1.0.0 | **Ratified**: 2025-01-26 | **Last Amended**: 2025-01-26
