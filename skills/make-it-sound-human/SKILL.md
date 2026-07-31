---
name: make-it-sound-human
description: >
  Cut a draft before adding to it, kill banned phrasing, replace abstraction
  with the specific numbers already in the data, and name the weakest
  paragraphs rather than silently rewriting everything.

  Use this skill whenever the user asks to:
  - Punch up, edit, or improve a draft
  - Make writing sound less generic or less like AI wrote it
  - Tighten a piece that reads flat

  Trigger even for casual requests like "punch this up", "make this better",
  "edit my draft", "this reads flat", "does this sound like a person wrote
  it".
---

# make-it-sound-human

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

## Consumes

| File | Why | If missing |
|---|---|---|
| the draft | what to edit | ask for the draft or the slug |
| `context/voice.md` | the fixed floor plus site-specific rules and samples | continue with the fixed floor only, and say so |
| `data/strategy.json` | optional, to verify any number being sharpened is real | continue without it, note the gap |

## Produces

The draft in place, and a change log of what was cut and why.

## Procedure

1. Cut before adding. Report the word count before and after; a punch-up that grows the draft by more than 10 percent has failed.
2. Kill every banned phrase from `skills/_shared/voice-rules.md` and any additional ones in `context/voice.md`.
3. Replace abstraction with the specific number already present in the data. Never invent one to replace a vague claim; if no real number exists, cut the claim instead of sharpening it into a false precision.
4. Move the strongest claim into the first 100 words.
5. Report the three weakest paragraphs by name and why, rather than silently rewriting everything the user did not ask you to touch.

## Decision rules

- A punch-up is not a rewrite. Preserve the author's structure and claims; tighten them.
- Never soften an unsourced claim into a vaguer unsourced claim. Cut it.
- The em-dash rule and the rest of the slop check apply to the edited output, checked again after editing, not only before.

## Output

```
Before: <n> words   After: <n> words (<+/-n%>)

Cut:
  "<removed line>": <why: cliche / unsourced / redundant>

Weakest paragraphs (named, not rewritten silently):
  Paragraph <n>: <why it's weak>

Slop check after edit: <passed / issues remaining>
```

## Done when

Word count moved down or stayed flat, the slop check passes on the edited version, and the three weakest paragraphs are named with a reason rather than quietly changed.
