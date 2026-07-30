# Decisions

## 2026-07-29

- GSC snapshots end three UTC days before collection. Search Console data can lag, so this keeps every rolling 28-day comparison complete.
- GA4 Data API page reports expose page-level `keyEvents`, not arbitrary ordered page sequences preceding an event. `conversion_paths` and `paths_sampled` remain `0`; conversion-path tiering stays disabled instead of presenting direct event counts as paths.
- An active GA4 key event means the event returned a non-zero `keyEvents` value inside the selected window. A configured event with no activity cannot be discovered through the Data API alone.

## 2026-07-30

- `context_hash` covers the body of `context/business.md`, not the frontmatter. The frontmatter carries `strategy_version`, which every strategy write bumps, so hashing the whole file would make each write invalidate its own hash and the drift check would fire constantly on nothing. The body is trimmed at both ends before hashing, because rendering adds a blank line after the frontmatter.
- `context --sync` accepts the prose as authoritative by rehashing and bumping the version. It does not parse the edited prose back into records. Saying so in the output is deliberate: silently implying that hand-edited paragraphs became typed records would be worse than the gap itself.
- Field ownership is matched by longest dotted-path prefix, with a collapse rule so `pain_points.pp3.status` resolves to the `pain_points.status` owner rather than the `pain_points` owner. Without the collapse, per-record paths would always fall back to the coarsest rule and shared fields could not exist.
- Every ownership-legal change still requires a `decisions` entry covering its path. A strategy that changes without a recorded reason cannot be argued with three months later, which is the whole point of keeping it.
- The metric definitions live at `skills/_shared/metric-definitions.md`, not at `skills/explain-this-number/references/definitions.md` as v1 specified. Every skill cites them, so a copy owned by one skill would drift from the copy everyone else reads. The skill points at the shared file and holds no definitions of its own.
- Block 7's acceptance criteria are a test rather than a review step. `src/skills/shared.test.ts` fails the build when a required term is missing, when a definition loses its misuse or replacement line, when a skill omits the shared context-load block verbatim, or when a skill restates shared reference content instead of citing it.
