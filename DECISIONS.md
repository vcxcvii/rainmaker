# Decisions

## 2026-07-29

- GSC snapshots end three UTC days before collection. Search Console data can lag, so this keeps every rolling 28-day comparison complete.
- GA4 Data API page reports expose page-level `keyEvents`, not arbitrary ordered page sequences preceding an event. `conversion_paths` and `paths_sampled` remain `0`; conversion-path tiering stays disabled instead of presenting direct event counts as paths.
- An active GA4 key event means the event returned a non-zero `keyEvents` value inside the selected window. A configured event with no activity cannot be discovered through the Data API alone.
