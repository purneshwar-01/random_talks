# 4. Spec-Driven Development (SDD) Workflow & Protocol

> **Document ID:** `DOC-004`  
> **Status:** Mandatory Engineering Process  
> **Classification:** Development Governance & Protocol  
> **Last Verified:** 2026-10-20  

---

## 1. The Core Philosophy of SDD

In complex real-time distributed systems like RandomTalks—where WebRTC signaling, asynchronous Firestore transactions, hardware media devices, and reactive UI states intersect—ad-hoc code modifications inevitably cause regressions, memory leaks, and broken invariants.

**Spec-Driven Development (SDD)** guarantees that:
1. **The Specification is the Source of Truth:** Code is merely the binary execution of an approved specification document.
2. **Zero Unplanned Refactors:** No implementation begins without an approved technical blueprint detailing state transitions, UI tokens, and teardown lifecycles.
3. **Traceable Verification:** Every feature commit is validated against an end-to-end browser checklist.

---

## 2. The 4-Step Change Management Lifecycle

```
┌─────────────────────────────────┐
│ STEP 1: CONVERSATION ALIGNMENT  │ ──► Problem formulation, user story, & architectural consent
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ STEP 2: SPECIFICATION DRAFT     │ ──► Authoring `docs/specs/SPEC-XXX.md` with schemas & edge cases
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ STEP 3: SURGICAL IMPLEMENTATION │ ──► Strict code modification adhering strictly to SPEC-XXX
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ STEP 4: BROWSER VERIFICATION    │ ──► Playwright automated test, 0 lint errors, & checklist update
└─────────────────────────────────┘
```

### Step 1: Intentional Alignment & Scope Definition
- Discuss the requirement with stakeholders / pair programmer.
- Define what constitutes complete functionality and verify that it does not violate existing security, zero-vendor, or performance constraints.

### Step 2: Technical Specification Authoring (`docs/specs/SPEC-XXX.md`)
Prior to touching `src/`, author a dedicated spec markdown file with the following standard anatomy:
* **Context & Motivation:** Why is this change necessary?
* **Data Model Changes:** Firestore collection updates, invariants, and single-field indexing constraints.
* **UI/UX Tokens & Ergonomics:** Tailwind classes, responsive viewports, and active tactile states.
* **Component Lifecycle & Teardown:** Explicit unmount routines to guarantee zero ghost listeners or media track leaks.
* **Verification Criteria:** Specific browser scenarios required to certify completion.
* **Register in Roadmap:** Update `docs/7_MASTER_CHECKLIST.md` and `docs/8_PHASE_ROADMAP.md`.

### Step 3: Surgical Code Implementation
- Edit application source code adhering strictly to the written specification.
- Preserve existing comments, types, and unrelated docstrings.
- **The Iron Rule:** *Code must never deviate from the approved specification.* If a specification flaw is discovered mid-coding, the specification must be revised first.

### Step 4: Verification & Master Checklist Update
- Execute automated linter: `npm run lint` (must pass with 0 errors, 0 warnings).
- Execute build verification: `npm run build` (must compile cleanly with Vite).
- Verify in real multi-window browsers (using Playwright or two-window test runners).
- Update the item in `docs/7_MASTER_CHECKLIST.md` from `[ ] PENDING` to `[x] COMPLETED`.

---

## 3. Specification Template Index

New feature specifications are saved in the `docs/specs/` directory using standard 3-digit identifiers:

| Identifier | Domain Area | Target Phase | Status |
|---|---|---|---|
| `SPEC-001` | Discord-Style Multi-Peer Call Stage | Phase 2 | Planned |
| `SPEC-002` | Persistent Collaborative In-Call Scratchpad | Phase 2 | Planned |
| `SPEC-003` | Real-Time Audio Volume Visualizer HUD | Phase 2 | Planned |
| `SPEC-004` | Intelligent Gemini Conversational Coach | Phase 3 | Planned |
| `SPEC-005` | Dynamic Multi-Tag Semantic Matchmaking | Phase 3 | Planned |

---

## 4. Git Commit & Documentation Invariants

Every pull request or commit that introduces or modifies functionality must reference the corresponding specification:

```
feat(call): implement discord stage multi-peer packing (ref: SPEC-001, DOC-003)
docs(checklist): mark B.01 as completed in master tracker
```
