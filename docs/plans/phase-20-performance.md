# Phase 20 — Performance

**Summary:** Measures PWA startup, IndexedDB workspace performance, and BFF resource consumption against agreed targets.

---

## OD-200 — Measure PWA startup

### Atomic Instruction

Measure application startup with a representative manuscript.

### Definition of Done

- [ ] Measurements are recorded for: initial load, workspace load, Git repository load, manuscript load.

---

## OD-201 — Measure IndexedDB workspace

### Atomic Instruction

Measure local persistence with one manuscript, multiple manuscripts, references, and images.

### Definition of Done

- [ ] Performance limitations are documented.

---

## OD-202 — Measure BFF memory

### Atomic Instruction

Measure Go BFF memory usage.

### Definition of Done

- [ ] Normal operation is below 30 MB RAM, or an explicit exception is documented.

---

## OD-203 — Measure BFF CPU

### Atomic Instruction

Measure CPU under representative authentication/API load.

### Definition of Done

- [ ] Normal workload stays below 0.25 vCPU, or an explicit exception is documented.
