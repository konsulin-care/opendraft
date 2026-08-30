# ADR 014: Publication Pipeline

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §11, §32

## Context

Manuscripts need to be compiled into publishable formats with semantic representation.

## Decision

### Pipeline

```text
Quarto Markdown
      ↓
Quarto compilation
      ↓
HTML + RDF/Turtle
      ↓
SHACL validation
      ↓
Static artifacts
```

### Initial Outputs
- `article.html` — human-readable.
- `article.ttl` — machine-readable.

### CI/CD (GitHub Actions)
1. Checkout source.
2. Resolve pinned OpenDraft protocol.
3. Validate metadata.
4. Run Quarto.
5. Compile HTML.
6. Compile RDF/Turtle.
7. Validate with SHACL.
8. Publish static artifacts.
9. DOI release/versioning (if configured).

### Future
- PDF generation (Typst before JATS).
- JATS explicitly deferred.

## Consequences

- Reproducible builds via CI.
- Static hosting sufficient.
- No OpenDraft server required for publication.
- Protocol pinning ensures reproducibility.

## References

- PROPOSAL.md §11, §32
