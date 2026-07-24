# Plagiarism and Originality Audit

Generated on July 21, 2026.

This audit is a manual originality review. No external plagiarism-checking service was available in the local environment, so no similarity percentage is claimed.

| Section | Risk | Cause | Action taken |
|---|---:|---|---|
| General introduction | Medium | Earlier version was mostly long prose and could read like generic HR-system context | Added project-specific lifecycle explanation tied to roles, objectives, HR validation, AI limits, and DevOps evidence |
| Chapter 1 context | Medium | Academic metadata placeholders could dominate the chapter | Preserved missing-information honesty and added repository-specific workflow and system-context explanation |
| Chapter 2 planning | Medium | Comparable-solution text could become vendor-like or generic | Reframed comparison by project criteria and added scope-boundary diagram with limitations |
| Chapter 3 technology choices | Medium | Common technology descriptions risk mirroring official docs | Added technology-stack panel and rewrote around exact project responsibilities and trade-offs |
| Chapter 4 authentication | Low | JWT description relies on a standard | Kept citation to RFC 7519 and focused wording on the project's active-user lookup and refresh-token behavior |
| Chapter 5 scoring | Low | Mathematical rules could look generic if not tied to code | Linked formulas to `scoreCalculationService.js`, objective statuses, normalization, and team-objective tests |
| Chapter 6 HR validation | Medium | HR workflow language can sound procedural and repetitive | Added rule table and design-decision discussion about separating manager judgment from HR governance |
| Chapter 7 AI | High | AI sections often overclaim or reuse model documentation language | Emphasized synthetic dataset limitation, separated LLM drafting from prediction, and used only saved-artifact metrics |
| Chapter 8 DevOps | Medium | CI/CD definitions can become copied documentation | Replaced generic definitions with repository-specific pipeline stages and deployment limitations |
| Figure captions | Medium | Captions had repeated source wording | Kept consistent source notes but expanded surrounding text to interpret major figures |
| External documentation | Low | Official documentation is cited for frameworks and standards | Bibliography retained; project-specific explanation avoids copying source descriptions |
| Screenshots | Low | Missing screenshots could tempt fabricated visuals | Screenshot insertion deferred by user request; no screenshot figures included |

## Review Notes

- The report uses official documentation as citation support, not as copied prose.
- No technology logos or external images were inserted, avoiding visual copyright ambiguity.
- The wording was revised toward neutral first-person-free academic prose because individual/team ownership is not fully documented.
- Claims are tied to repository files through `REPORT_EVIDENCE.md`.
- Limitations are stated explicitly where evidence is missing: academic metadata, seeded screenshots, real AI validation data, E2E coverage, monitoring, security audit, and full AI-service deployment.

