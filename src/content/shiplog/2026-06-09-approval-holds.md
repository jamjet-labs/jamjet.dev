---
date: 2026-06-09
area: runtime
---
Approvals now survive lease reclaim. A late "yes" resumes the run instead of orphaning it, and approvals on already-finished runs are refused instead of silently accepted.
