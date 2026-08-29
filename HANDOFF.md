# HANDOFF DOCUMENT

**Date generated:** 2026-07-29
**Note:** This is an auto-generated handoff document intended to let another AI assistant continue this report with no prior context. Unlike a chat-only handoff, this project lives on disk — every file referenced below is a real, persistent file in the project directory, not something that disappears when this conversation ends. A new assistant should **read the actual files**, not rely solely on this document for technical facts; this document's job is to capture the *decisions and context* that aren't written down anywhere else, and to index where everything lives.

---

## 1. Project Identity

- **Report title (from the LaTeX title page):** "PerTrack: An Enterprise Performance and OKR Management Platform" — a National Engineering Degree Final Year Project (PFE) report.
- **What this is:** A university PFE (Projet de Fin d'Études) report documenting **PerTrack**, a real, existing HR performance-evaluation and OKR-management web platform (Node/Express + MongoDB backend, React/Vite frontend, Python/Flask ML microservice, Kubernetes/ArgoCD deployment) located in this same project directory under `backend/`, `frontend/`, and `ai-service/`. The report is being written *about* this real codebase — every technical claim in it must trace back to actual code, not be invented.
- **How this session's work arc unfolded** (reconstructed, since there was no single original brief but a long iterative sequence):
  1. Deep codebase analysis of the whole PerTrack project (models, routes, frontend pages, DevOps, AI).
  2. Design of a report Table of Contents modeled structurally on a *different, unrelated* reference report (Walid Khrouf's "Exzellent" language-learning-platform PFE report, a PDF the user shared) — same chapter/section skeleton, entirely different (PerTrack) content.
  3. Multiple ToC revision passes: first version missed real features (tasks, sub-teams, feedback, meetings, notifications, calendar, correction requests, audit log, reporting); user explicitly rejected a version that added new chapters to fit them in and required folding them into the **existing 8-chapter structure** instead.
  4. Generation of ~33 UML/architecture diagrams as `.drawio` (Draw.io/diagrams.net XML) files, plus fixes to 3 of them and 2 new ones to close gaps against the finalized ToC.
  5. Full LaTeX report written chapter-by-chapter matching the final ToC exactly, with a strict rule: **technical content written in full real depth; personal/organizational facts the assistant cannot know are marked as placeholders, never invented.**
  6. A list of logo images (competitor products + tech stack) still needs sourcing by the user.
- **Deadline/timing context:** None was ever given by the user in this session.

---

## 2. Current Completion Status

**Overall estimate: ~80% complete.** All prose content is written and the document compiles cleanly. What remains is entirely on the user's side: filling in personal/organizational facts, exporting diagrams to images, and sourcing logo images.

| Section | Status | Notes |
|---|---|---|
| Title page | Done (structure) | Institution name, student name, supervisors, date are `\fillin{}` placeholders |
| General presentation | Done | Fully written prose |
| Ch.1 Global context | Done (prose) / Needs Revision (facts) | §1.2.1 (host institution), §1.2.4 (methodology), §1.3 (tools used) are placeholders — real content unknown to the assistant |
| Ch.2 Assessment & planning | Done (prose) / Needs Revision (facts) | Competitor analysis (Workday/Lattice/15Five) fully written from general product knowledge; §6 Gantt/scheduling is a placeholder — no real dates known, and **no diagram file exists for the Gantt chart at all** (needs to be created from scratch) |
| Ch.3 Project initiation | Done | Fully written; all technical content grounded in the real codebase |
| Ch.4 Sprint 1 (Entity & access) | Done | Fully written; backlog table story-point column is a placeholder |
| Ch.5 Sprint 2 (Objective & cycle) | Done | Fully written; backlog table story-point column is a placeholder |
| Ch.6 Sprint 3 (Evaluation/HR/Collaboration) | Done | Fully written; backlog table story-point column is a placeholder |
| Ch.7 Sprint 4 (AI features) | Done | Fully written |
| Ch.8 Sprint 5 (DevOps) | Done | Fully written; backlog table story-point column is a placeholder |
| General conclusion | Done (prose) / Needs Revision (facts) | Limitations/future-work have real content plus two placeholders for anything only the user knows; final paragraph (personal reflection) is entirely a placeholder |
| Figures (all chapters) | **Not started (images)** | Every figure is a `\figplaceholder{}` box, not a real image — see §4/§8 below |
| Logos (competitor + tech stack) | **Not started** | List given to user; not yet sourced |

---

## 3. Full Outline / Table of Contents

```
General presentation
Chapter 1: Global context
  1. Introduction
  2. Project workspace
     2.1 Host institution | 2.2 The PerTrack platform | 2.3 PerTrack's audience | 2.4 Development methodology
  3. Used tools
  4. Conclusion
Chapter 2: Project assessment and planning
  1. Introduction
  2. Description of PerTrack
  3. Problem statements
  4. Available solutions (4.1 Workday, 4.2 Lattice, 4.3 15Five)
  5. Study of the existing
  6. Project scheduling
  7. Conclusion
Chapter 3: Project initiation
  1. Introduction
  2. Requirements specification
     2.1 Users identification
     2.2 Functional requirements (2.2.1 through 2.2.10: user/team mgmt, cycle/objective mgmt, check-ins,
         task mgmt, evaluation/HR decisions, collaboration/communication, notifications/reminders,
         correction requests, reporting/analytics/audit, AI-assisted features)
     2.3 Non-functional requirements (2.3.1 Performance, 2.3.2 Security & auditability,
         2.3.3 Observability, 2.3.4 Evolvability)
     2.4 Backlog
  3. Project architecture (3.1 Logical architecture, 3.2 Platform structure)
  4. Tools and technologies (4.1 through 4.9: Node.js, Express.js, MongoDB/Mongoose, React+Vite,
     Python/Flask, Docker, Kubernetes/ArgoCD, Postman, @dnd-kit)
  5. Conclusion
Chapter 4: Sprint 1 -- Entity and access management
  1. Introduction | 2. Functionality overview
  3. Functional specifications (3.1 backlog, 3.2 use case diagram, 3.3 sequence diagram, 3.4 class/entity diagram)
  4. Technical specifications (4.1 JWT, 4.2 Bcrypt, 4.3 RBAC middleware, 4.4 Audit logging)
  5. Build phase (5.1 sign-in flow, 5.2 team hierarchy mgmt, 5.3 cycle creation)
  6. Conclusion
Chapter 5: Sprint 2 -- Objective and cycle workflow
  1. Introduction | 2. Functionality overview
  3. Functional specifications (3.1 backlog, 3.2 use case diagram, 3.3 sequence diagram, 3.4 document/class model)
  4. Technical specifications (4.1 business rules incl. MIN/MAX_OBJECTIVES & TOTAL_OBJECTIVE_VALUE,
     4.2 weighted score computation, 4.3 visibility/access control, 4.4 task board, 4.5 correction requests,
     4.6 notification triggers)
  5. Build phase (5.1-5.6: objective creation, approval UI, check-ins, task board, correction UI, notification center)
  6. Conclusion
Chapter 6: Sprint 3 -- Evaluation, HR decisions and career development
  1. Introduction | 2. Functionality overview
  3. Functional specifications (3.1 backlog, 3.2 use case diagram, 3.3 sequence diagram, 3.4 document model)
  4. Technical specifications (4.1 score calc service, 4.2 consistency-warning logic, 4.3 PDF/analytics,
     4.4 feedback visibility, 4.5 meeting/calendar sync)
  5. Build phase (5.1-5.5)
  6. Conclusion
Chapter 7: Sprint 4 -- AI features
  1. Introduction | 2. Functionality overview
  3. Functional specifications (3.1 backlog, 3.2 use case diagram, 3.3 document/class model)
  4. Technical specifications (4.1 provider-agnostic AI adapter, 4.2 prompt/JSON validation,
     4.3 Flask ML microservice, 4.4 scikit-learn/XGBoost, 4.5 synthetic dataset)
  5. Build phase (5.1-5.3)
  6. Conclusion
Chapter 8: Sprint 5 -- DevOps
  1. Introduction
  2. Functional specifications (2.1 backlog)
  3. Technical specifications (3.1 GitHub Actions, 3.2 Jest/Supertest, 3.3 Gitleaks, 3.4 Docker,
     3.5 Trivy, 3.6 Kubernetes/Kustomize, 3.7 ArgoCD)
  4. Build phase (4.1-4.5)
  5. Conclusion
General conclusion and perspectives
```

All sections above are **Done** (written) except the specific placeholder items called out in §2's table.

---

## 4. Full Verbatim Draft Content

**The complete, real, verbatim text already exists in full at:**
```
documentation/report/main.tex
```
This is a persistent project file (850+ lines), not chat-only content — it will still be there in a new session. I am **not** duplicating all 850 lines into this handoff document, because that would just be a stale copy sitting next to the real, editable, already-compiling source of truth. A new assistant should open and read `main.tex` directly.

To satisfy "give real words, not descriptions," here is one representative verbatim excerpt (the opening of the General Presentation, exactly as it appears in the file) so the tone/style is unambiguous:

> "As part of my graduation project, I contributed to the design and development of **PerTrack**, an enterprise performance-evaluation and Objectives-and-Key-Results (OKR) management platform. PerTrack was built to replace informal, spreadsheet-driven performance review practices with a structured, auditable digital workflow: employees set goals within a defined annual cycle, track their progress through periodic check-ins, receive mid-year and final evaluations blending self-assessment with manager scoring, and see evaluation outcomes translate into concrete human-resources decisions such as promotions, bonuses, or coaching plans."

No older/superseded drafts of any chapter exist — each chapter was written once, directly into `main.tex`, in the final agreed style (see §5).

**Compiled output:** `documentation/report/main.pdf` (50 pages, generated via two `pdflatex` passes, zero errors, one benign "rerun for cross-references" warning on the first pass only).

---

## 5. Style, Formatting & Content Rules

- **Document class:** `report`, `12pt`, `a4paper`, `\onehalfspacing` (via `setspace`).
- **Packages loaded:** `inputenc`, `fontenc`, `geometry`, `graphicx`, `hyperref`, `xcolor`, `booktabs`, `amsmath`, `listings`, `fancyhdr`, `titlesec`, `caption`, `float`, `enumitem`, `setspace`.
- **Two custom macros defined in the preamble — reuse these, don't invent new placeholder conventions:**
  - `\fillin{description}` → renders **red bold `[FILL IN: description]`**. Used for every fact only the real student/user knows: host institution identity, actual methodology/tools used, real dates, story-point estimates, personal reflection. **Never replace a `\fillin` with an invented fact.**
  - `\figplaceholder{filename}{caption}{label}` → renders a boxed placeholder figure. Used for every diagram, since none are exported to PNG/PDF yet. Once a real image exists at `figures/<filename>`, replace the macro call with a plain `\includegraphics` figure using the *same* caption and label (so all `\ref{}`/`\label{}` cross-references keep working).
- **Tone:** academic PFE report, first-person/first-person-plural where natural ("we implemented," "our approach"), original wording throughout, deliberately varied sentence structure and paragraph openers to avoid repetitive/generic AI-sounding phrasing (this was an explicit user instruction).
- **No word-count targets** were specified per section.
- **No citation/bibliography system** is used — the report has no external sources to cite (see §6); competitor descriptions (Workday/Lattice/15Five) are written from general product knowledge, not sourced quotes.
- **Headers/footers:** `fancyhdr`, left header = report title, right header = current chapter (`\leftmark`), centered page number.

---

## 6. Data, Research & Sources

| Source | Path/Location | Used for |
|---|---|---|
| PerTrack backend source | `backend/` (routes, controllers, models, middleware, cron, scripts) | Every technical claim in Ch.3–8: 20 Mongoose models, 26 route modules, business rules, auth flow |
| PerTrack frontend source | `frontend/` (pages, components, routes, context) | Frontend architecture facts, page-to-feature mapping used across all sprint chapters |
| PerTrack AI microservice | `ai-service/` (Flask app, models, training scripts) | Chapter 7 AI content (scikit-learn/XGBoost, synthetic dataset) |
| CI/CD config | `.github/workflows/docker-build.yml`, `k8s/` overlays | Chapter 8 DevOps content (pipeline stages, Kustomize, ArgoCD) |
| `documentation/uml/generated/*.drawio` | Same project, `documentation/uml/generated/` | Every figure reference across the report (see §8 for full file list) |
| `documentation/uml/generated/README.md` | Same project | Authoritative diagram-to-ToC-section mapping — **read this before touching any figure reference** |
| Walid Khrouf's "Exzellent" PFE report (PDF, user-supplied) | Not a project file — was pasted into the chat earlier in this session | **Structural/style template only.** Used to decide the ToC's chapter shape and per-tool "one paragraph + one logo" pattern. **Zero content from it appears in the PerTrack report** — it documents a completely unrelated language-learning platform. |
| External web sources | None | No web research was performed for this report; everything is grounded in the local codebase or general public knowledge of named commercial products (Workday, Lattice, 15Five) |

No code, scripts, or calculations were used to generate figures/charts — all figures are hand-authored `.drawio` diagrams (listed in §8), not data-driven charts.

---

## 7. Decisions, Assumptions & Open Questions

**Firm decisions made by the user (do not silently reverse these):**
- Exactly **8 chapters** (plus General presentation and General conclusion) — the user explicitly rejected a 10-chapter/7-sprint restructuring and required new features to be folded into the existing chapters as subsections instead.
- Diagrams must be genuine, evidence-based — no invented use cases/classes/fields not backed by real code.
- Personal/organizational facts must be placeholders, never invented, even when it would be easy to fabricate something plausible.

**Assumptions made by the assistant, not explicitly confirmed by the user:**
- That `report` (not `article`) is the correct LaTeX class — inferred from the `\chapter`-level ToC structure, never explicitly stated by the user.
- That competitor descriptions (Workday/Lattice/15Five) can be written from general product knowledge without citations — the user never specified a citation requirement either way.
- That the Gantt chart, which has no source diagram at all, should be flagged as needing to be created from scratch rather than skipped or faked — the user has not yet confirmed this is acceptable.

**Explicitly flagged but never resolved (raised multiple times, user never confirmed doing them):**
1. The `ImprovementPlan` model/feature is not named in the Ch.6 prose (it *is* present in the diagrams, just not mentioned in the report text).
2. The mid-year `Evaluation` Mongoose model (distinct from `FinalEvaluation`) is not explicitly named in Ch.6's document-model figure list.
3. "Team Activity Feed" is mentioned in Ch.3 requirements but was never given an explicit build-phase sentence in Ch.4 or Ch.6.
4. The email-delivery channel for notifications (`Nodemailer`/SMTP, distinct from in-app notifications) is not mentioned in Ch.5's notification section.
5. A frontend page named `HRValidation` (separate from the team-leader-facing `Validation` page) hints the real objective-approval flow might be **two-tier** (Team Leader review, then a separate HR validation gate) rather than the single-level flow described in Ch.5 — **this was never verified against the actual controller code**, only inferred from a page name. Treat as unconfirmed, not fact.

**No conflicting instructions arose during this session** that required a judgment call to resolve — the ToC iterations were refinements, not contradictions.

**No older drafts exist to revert to** (see §4).

---

## 8. Immediate Next Steps

1. **Fill in every `\fillin{}` in `documentation/report/main.tex`.** Search the file for `\fillin{` to find every instance. Key ones: title page (institution, student name, supervisors, date), §1.2.1 host institution, §1.2.4 methodology, §1.3 tools used, Ch.2 §6 Gantt/dates, every sprint chapter's backlog story-point column, and the three placeholders in the General conclusion (limitations, future work, personal reflection).
2. **Create the Gantt chart from scratch** once real sprint dates are known — no `.drawio` source exists for this one; it needs to be built new (e.g., directly in LaTeX with `pgfgantt`, or as a diagram exported to `figures/gantt_chart.png`).
3. **Export every diagram referenced by a `\figplaceholder{}` call to PNG or PDF**, placed in `documentation/report/figures/`. Full file list (source `.drawio`, all in `documentation/uml/generated/`): `perftrack_diagram_1_architecture`, `01_Authentication_User_Management`, `05_Team_Management`, `perftrack_diagram_3_auth_sequence`, `00_Domain_Class_Diagram`, `02_Objective_Management`, `03_CheckIn_Progress`, `06_Task_Management`, `22_objective_approval_sequence`, `PerTrack_Document_Model_Diagram` (three separate crops needed for Ch.5/6/7), `04_Performance_Evaluation`, `07_Feedback_Management`, `23_meetings_calendar_usecase`, `09_Reporting_PDF`, `perftrack_diagram_7_final_evaluation_sequence`, `perftrack_diagram_8_ai_assistant_usecase`.
4. **Source the logo images** listed for Ch.2 (Workday, Lattice, 15Five) and Ch.3/8 (Node.js, Express.js, MongoDB, React, Vite, Python, Flask, Docker, Kubernetes, ArgoCD, Postman, @dnd-kit, GitHub Actions, Jest, Gitleaks, Trivy, Docker Hub) into `documentation/report/figures/logos/`. Two `\figplaceholder` calls for Workday and Lattice already exist in the file (added mid-session); the rest still need the same treatment added.
5. **Once images exist**, replace each `\figplaceholder{file}{caption}{label}` call with a plain figure using `\includegraphics{figures/<file>}` and the **same** `caption`/`label` arguments, so no cross-reference breaks.
6. **Recompile** with two `pdflatex` passes (first pass reports "Label(s) may have changed," second pass resolves it — this is normal, not an error).
7. **Decide on the five open items in §7** (ImprovementPlan naming, Evaluation model naming, Team Feed build-phase mention, email notification channel, and verifying the possible two-tier HR validation flow against the real controller code) — these are known, named gaps, not oversights the next assistant needs to rediscover.
8. **Move or delete `documentation/uml/generated/Exzellent_Document_Model_Diagram.drawio`** — it belongs to the unrelated Exzellent project and was only generated in this folder as a byproduct of an earlier, separate request. It is not referenced anywhere in the PerTrack report.

---

## 9. Anything Else Worth Knowing

- **Do not let a future assistant re-litigate the chapter count.** The 8-chapter structure was arrived at after the user explicitly rejected a 10-chapter alternative. If asked to "add missing features," the correct move is a new subsection inside an existing chapter, not a new chapter.
- **Do not invent institution/personal facts to "finish" the report.** The `\fillin{}` markers are load-bearing — the user was explicit, more than once across this session, that fabricated personal/organizational content is unacceptable even when it would make the document look more complete.
- **The codebase is ground truth, this document is not.** If anything in this handoff appears to conflict with what the actual source code says, trust the code and update this handoff, not the other way around.
- **Compilation is verified working** as of this session: `pdflatex -interaction=nonstopmode main.tex`, run twice, from `documentation/report/`, produces a clean 50-page PDF with zero errors.
- **The `.drawio` files themselves are already correct and complete** — the only remaining diagram work is the mechanical step of exporting them to raster/vector images; no further diagram authoring should be needed unless new content is added to the report later.
