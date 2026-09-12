# ADR 001: Layered source fallback

## Status
Accepted

## Decision
The library is the primary source. A snapshot provides field-level fallback only for fields absent from the library. A normalized, citable cache is the final fallback and may be at most six hours old. Every displayed value requires provenance and an as-of timestamp. Absence of coverage must not trigger a live fetch. Instead, show an explicit `verified coverage unavailable` state for fields that cannot meet these requirements.

## Consequences
This preserves library authority, permits narrowly scoped recovery, and keeps citations auditable. Stale or unverifiable data is not presented as verified.
