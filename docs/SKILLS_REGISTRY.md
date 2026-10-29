# RandomTalks Pro — Skills & Tools Registry Ledger
**Document ID:** `DOC-009`  
**Classification:** Core Engineering Systems & Skills Registry  
**Protocol:** GSD (Get Shit Done) Phased Protocol & Autonomous Self-Healing Loop  
**Last Updated:** 2026-10-27  
**Status:** ACTIVE & ENFORCED  

---

## 1. Registry Architecture & Mission Charter

The Skills & Tools Registry serves as the permanent configuration ledger for AI agent capabilities, autonomous engineering plugins, and execution protocols utilized across RandomTalks Pro. It codifies triggers, invocation patterns, slash commands, and boundary constraints to maintain context preservation, zero-bloat standards, and continuous self-healing across development sprints.

---

## 2. Core Active Tools & Skills

### 2.1 GSD (Get Shit Done) Engine
- **Identifier:** `gsd-build/get-shit-done`
- **Classification:** Phased Unit Execution & Context Preservation Engine
- **Purpose:** Enforces structured, sequential phased execution (Assess &rarr; Plan &rarr; Execute &rarr; Verify &rarr; Ledger). Prevents context thrashing, drift, and premature task termination by dividing complex refactors into discrete verifiable work units.
- **Trigger Guidelines:**
  - Mandatory on any multi-file architectural change, refactoring, or feature implementation.
  - Activated whenever a task spans more than 2 distinct domains (e.g. build tooling + components).
- **Execution Protocol:**
  1. **Phase 1: Foundation & Registry:** Setup ledgers, baseline invariants, and clear boundaries.
  2. **Phase 2: Atomic Execution:** Execute modifications file-by-file with immediate validation.
  3. **Phase 3: Closed-Loop Verification:** Run autonomous testing, build validation, and ledger sign-off.
- **Slash Commands & Invocations:**
  - `/plan`: Initiates phased work breakdown structure.
  - `/goal`: Executes long-running thorough delivery across phases.

---

### 2.2 CodeRabbit AI Skills
- **Identifier:** `coderabbitai/skills`
- **Classification:** Autonomous Code Review, Security & Memory Leak Auditor
- **Purpose:** High-rigor static and semantic analysis engine inspecting pull requests and local diffs for memory leaks (WebRTC peer connections, untracked `setInterval`/`setTimeout`, missing event listener teardowns, dangling media streams), security regressions (Firestore rules bypasses, sensitive environment leaks), and anti-patterns.
- **Trigger Guidelines:**
  - Run prior to committing any file in `src/pages/CallRoom.jsx`, `src/lib/matchmaking.js`, or `firestore.rules`.
  - Required after decommissioning dependencies to verify zero broken imports.
  - Required when creating or modifying WebRTC media stream lifecycles.
- **Audit Checklist:**
  - [ ] No uncancelled `requestAnimationFrame`, `setTimeout`, or `setInterval` references.
  - [ ] Media tracks explicitly stopped via `.getTracks().forEach(t => t.stop())`.
  - [ ] PeerConnection instances closed and nullified (`pc.close(); pc = null;`).
  - [ ] Zero unhandled Promise rejections in Firestore transaction or write paths.
  - [ ] No residual or phantom imports from uninstalled packages.
- **Invocations:**
  - Automated pre-build sanity scan across all git-modified files.

---

### 2.3 Ralph Loop (Autonomous Self-Healing Verification Engine)
- **Identifier:** `ralph-loop`
- **Classification:** Closed-Loop Verification & Self-Healing Engine
- **Purpose:** Executes automated cycles of compilation, linting, and runtime checks. When a failure is detected, the Ralph Loop autonomously captures the stack trace, parses error codes, inspects offending files, applies fixes, and re-runs the build without user intervention until exit code `0` is achieved.
- **Trigger Guidelines:**
  - Automatically triggered upon completion of file modifications in any build-impacting step.
  - Must pass before declaring completion of any task or phase.
- **Execution Lifecycle:**
  ```mermaid
  stateDiagram-v2
      [*] --> BuildExecution: npm run build
      BuildExecution --> Success: Exit Code 0
      BuildExecution --> FailureAnalysis: Exit Code != 0
      FailureAnalysis --> AutonomousPatching: Parse Diagnostics & Apply Diffs
      AutonomousPatching --> BuildExecution: Re-verify
      Success --> [*]: Emit Verified Ledger
  ```
- **Invocations:**
  - Automated terminal run: `npm run build` &rarr; autonomous repair loop &rarr; exit code 0.

---

### 2.4 UI/UX Pro Max Engine
- **Identifier:** `nextlevelbuilder/ui-ux-pro-max-skill`
- **Classification:** Tactile Clay Design System & Discord Layout Heuristics
- **Purpose:** Governs the frontend aesthetic of RandomTalks Pro based on Discord-style auto-packing grids, Raycast ambient spotlighting, Linear micro-interactions, and Framer Motion spring physics.
- **Core Design Invariants:**
  - **Color Tokens:**
    - Primary Amber: `#FCA311`
    - Deep Navy Canvas: `#14213D`
    - Void Background: `#07090E`
    - Surface Card: `#FFFFFF` / Dark Tile: `#111318`
    - Muted Slate: `#475569`
  - **Framer Motion Physics (Law 31):**
    - `springTransition`: `{ type: 'spring', stiffness: 380, damping: 30 }`
    - `snappySpring`: `{ type: 'spring', stiffness: 450, damping: 25 }`
  - **Active Speaker Border (SPEC-001):**
    - RMS Volume > 15: `border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/50`
  - **Audio & Media Safety:**
    - Zero video ref flickering: decoupled state and ref assignment.
- **Invocations:**
  - Enforced during component authoring, CSS styling, and modal implementations.

---

### 2.5 Firebase Agent Skills
- **Identifier:** `firebase/agent-skills`
- **Classification:** Security Rules Auditor, Firestore Indexing & Auth State Management
- **Included Modules:**
  - `firebase-security-rules-auditor`: Deep security scan against privilege escalations, unauthorized resource access, and injection flaws.
  - `firebase-firestore`: Data model design, query optimization, and single-field index compliance.
  - `firebase-auth-basics`: Observer lifecycles, route guards, and identity token management.
  - `firebase-basics`: CLI deployment and project configuration.
- **Trigger Guidelines:**
  - Invoked on changes to `firestore.rules`, `firestore.indexes.json`, or `src/lib/matchmaking.js`.
  - Required when creating new collections or adjusting read/write rules.
- **Current Rules Baseline Invariant:**
  - All Firestore queries must utilize single-field index constraints (`firestore.indexes.json: []`) to prevent cold-start index failures.
- **Invocations:**
  - Pre-deployment security rules audit and schema verification.

---

## 3. Skills Registry Matrix & Slash Command Cheat Sheet

| Skill / Tool Identifier | Source Repository | Primary Capability | Slash Command / Trigger |
|---|---|---|---|
| **GSD Engine** | `gsd-build/get-shit-done` | Phased unit execution, context preservation | `/plan`, `/goal` |
| **CodeRabbit** | `coderabbitai/skills` | Code review, memory leak hunt, safety checks | Pre-commit automated hook |
| **Ralph Loop** | `internal/ralph-loop` | Autonomous self-healing, build loop | Automated on `npm run build` |
| **UI/UX Pro Max** | `nextlevelbuilder/ui-ux-pro-max-skill` | Discord auto-grid, clay tokens, spring motion | UI feature implementation |
| **Firebase Skills** | `firebase/agent-skills` | Rules auditor, index compliance, Auth sync | Changes to `firestore.rules` / `src/lib/` |

---
*Registry maintained under RandomTalks Pro Engineering Specifications.*

