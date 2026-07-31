---
name: know-my-buyer
description: >
  Interview the site owner about who buys, in their own words, grounded in a
  real diagnosis rather than generic questions, and write the shared business
  context every other skill reads. Refuses to run without a diagnosis.

  Use this skill whenever the user asks to:
  - Get grilled or interviewed about their business
  - Figure out who they are actually for, or sharpen their positioning
  - Set up Rainmaker's business context for the first time
  - Explain their ICP, personas or buyer language

  Trigger even for casual requests like "grill me", "who are we actually for",
  "I don't know what to write about", "set up my business context", "our
  positioning is vague, help", or on first run after `rainmaker audit`.
---

# know-my-buyer

## Context load

Run `rainmaker context --check` first. It prints what exists, what is stale, and exits 1 if anything this skill requires is missing.

Then read, in this order:

1. `context/business.md` in full. If absent, stop: "No business context. Run `rainmaker audit`, then the `know-my-buyer` skill."
2. `context/voice.md` if this skill writes prose. If absent, stop and say so.
3. `context/glossary.md` if this skill names products, features or competitors.
4. `data/strategy.json` if this skill reads or writes strategy.
5. Only the `data/` files listed in this skill's Consumes table. Never crawl or call an API the core already covers.

If `strategy.json.context_hash` does not match the current hash of `context/business.md`, say exactly:

"Business context was edited after the strategy was written. Re-run `know-my-buyer`, or run `rainmaker context --sync` to accept the prose as authoritative."

Then stop.

If `context/business.md` carries `confidence: stub`, continue, and stamp every output with: "Built on a stub context. Nothing in it came from a buyer. Run `know-my-buyer` to replace it."

**Override for this skill only:** a stub is exactly what `know-my-buyer` exists to replace. Do not stop, and do not repeat the stamp above during the interview itself; the stamp is for skills that read the context, not the one that writes it.

## Consumes

| File | Why | If missing |
|---|---|---|
| `data/snapshots/<latest>/diagnosis.json` | tier distribution and top findings to open with | refuse, see below |
| `data/competitors.json` | contrast points for the opening summary | continue without it, note the gap |
| `context/business.md`, `data/strategy.json` | the stub or prior interview to build on | `rainmaker context --init` first if truly nothing exists |

## Produces

`context/business.md` (new version, prior archived to `context/history/`), `data/strategy.json` (version bump, prior archived to `data/strategy-history/`).

## Refuses when

No diagnosis exists. Print exactly: "Run `rainmaker audit` first. Interrogating you about a site I have not looked at produces generic questions." Do not proceed under any circumstance, including a user insisting they already know their answers: the value of this skill is that every question cites a number, and there is no number to cite yet.

## Procedure

1. Read `diagnosis.json`. Open with three sentences of fact and nothing else: the tier distribution, the top 3 findings by `revenue_score`, and the sharpest contrast against `competitors.json` if it exists. No adjectives, no framing, just the numbers.
2. Ask **one question at a time**. Never batch, never parallelise. Question N depends on the answer to N-1, and that dependency is the entire value of an interview over a form.
3. Ask a minimum of 12 questions, covering, in this rough order: who pays, who blocks the deal, what they were doing before finding us, the exact words used in the last deal won, the exact words used in the last deal lost, which page sales actually sends before a close, which page the diagnosis says is broken that sales still sends anyway, which competitor came up in the last three deals, what we refuse to claim and why, what we would bet the quarter on, what would prove this whole strategy wrong.
4. **Every question must cite a specific finding, number or competitor fact from the diagnosis.** A question that could be asked of any company is a defect. Bad: "Who is your target customer?" Good: "Your `/pricing` page carries 1,240 impressions and 11 clicks over 28 days, sitting at position 8.4. Who reads that page before a deal closes, and what do they still not know when they leave it?"
5. When an answer is generic ("enterprise companies", "anyone who needs X"), push back once, quoting their own words back at them, and ask for the specific deal it happened in. Accept the second answer even if it is still imperfect; two rounds is the budget, not zero and not five.
6. As pain points emerge, write them immediately with an `id`, the verbatim `buyer_language`, and the `evidence` type. **A pain point with an empty `buyer_language` array is a defect.** If the interview has not yet produced a direct quote for a pain point you believe exists, ask again rather than paraphrasing one into existence.
7. At the close, write both artifacts via `rainmaker context --sync` semantics: update `context/business.md` in full, matching every persona, pain point, proof point and competitor to the same `id` in `data/strategy.json`. Bump `strategy_version`. Record a `decisions` entry for every field that changed from the prior version, with a one-line reason.
8. Summarise what changed: which prior beliefs were confirmed, which were overturned, and which questions remain open (write these to the "Open questions" section of `business.md` rather than leaving them unrecorded).

## Decision rules

- 12 questions is a floor, not a target to race past. A fast-moving user is not a reason to cut the pain-point or objection lines of inquiry short.
- Never invent a `buyer_language` quote. Paraphrase is a downgrade and must be marked as such if used at all (`status: hypothesis`, never `validated`).
- Never write a proof point without a source. "They said their close rate improved" without a proof id is not evidence.
- The "what we will not say" section is mandatory even when the user has nothing to add. Ask once directly: "Is there any claim you would not want us to make, even if it were technically true?" If the answer is genuinely nothing, write that the section was asked and nothing was named, rather than leaving it blank with no record it was asked.

## Output

The live interview is conversational, one question visible at a time. The closing summary:

```
## Business context updated: version <n>

Confirmed: <beliefs that held>
Changed: <beliefs that moved, and why>
New: <personas, pain points, proof added>
Open questions: <what the interview could not settle>

context/business.md and data/strategy.json are in sync (hash <short hash>).
```

## Done when

At least 12 questions were asked one at a time, every pain point has non-empty `buyer_language` or is explicitly marked `hypothesis`, both artifacts are written with matching ids and a matching `context_hash`, the prior version is archived, and every changed field has a `decisions` entry with a reason.
