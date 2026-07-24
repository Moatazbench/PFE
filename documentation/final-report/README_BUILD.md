# Build Instructions

Build from this directory:

```powershell
latexmk -pdf -interaction=nonstopmode main.tex
```

The expected output is `main.pdf`.

The report uses `pdflatex`, `biblatex`, and `biber` through `latexmk`.

Current verified build:

- Output: `main.pdf`
- Pages: 87 A4 pages
- Figures: 28
- Tables: 32
- Screenshots: 0, deferred by user request

The raw detailed backend route inventory remains available as `appendices/backend-route-inventory.tex`, but it is not included in the compiled PDF to keep the report within the target page range.
