# Final QA Report

Generated on July 21, 2026.

## Build Verification

- Command: `latexmk -pdf -interaction=nonstopmode main.tex`
- Output: `documentation/final-report/main.pdf`
- Result: successful PDF compilation.
- PDF size: 85 A4 pages.
- Bibliography: 16 entries, resolved with Biber through `latexmk`.
- Figure and table inventories: 20 figures and 30 tables.
- Visual QA: selected pages were rendered with Poppler and inspected, including the cover, chapter pages, screenshot placeholders, the landscape backend route inventory, and the bibliography.

## Application Evidence Checks

- Repository structure inspected: `frontend`, `backend`, `ai-service`, `.github`, `k8s`, and existing documentation artifacts.
- Backend tests passed: 9 suites, 45 tests.
- Frontend tests passed: 5 suites, 14 tests.
- Frontend build passed with Vite.
- AI model artifacts were evaluated from saved repository files without retraining:
  - Rating RF accuracy: 0.9715.
  - Rating XGB accuracy: 0.9780.
  - Promotion RF accuracy: 0.7505, ROC-AUC: 0.8346.
  - Promotion XGB accuracy: 0.7480, ROC-AUC: 0.8218.

## Known Limitations

- Academic identity fields remain placeholders because the repository does not contain student, university, supervisor, host-organization, logo, or signature data.
- UI screenshot boxes are intentional placeholders because no seeded authenticated runtime session was available.
- The AI dataset is synthetic, so the report treats AI metrics as prototype evidence rather than production validation.
- The Python AI service is present in the repository but not fully represented in Docker Compose or Kubernetes deployment manifests.
- No end-to-end browser suite, coverage report, formal accessibility audit, or full manual security audit was available in the repository evidence.

## Source Integrity

- Application source code was not modified for the report.
- New report material is isolated under `documentation/final-report/`.
