---
name: write-the-page
description: >
  Write a draft from a brief, matching the site's real voice samples rather
  than a description of the voice, covering every standalone claim, and
  passing the slop check on itself before returning.

  Use this skill whenever the user asks to:
  - Write a draft, an article, or a page from a brief
  - Turn a brief into actual copy

  Trigger even for casual requests like "write the draft", "write this
  article", "draft <slug>", "turn this brief into a page".
---

# write-the-page

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
| `briefs/<slug>.md` | everything the draft must cover | "No brief for <slug>. Run `brief-my-writer` first." |
| `context/voice.md` | real samples to match | required, see context load |
| `data/strategy.json` | proof ids to verify against | run `know-my-buyer` |

## Produces

`drafts/<slug>.md`.

## Refuses when

No brief exists for the requested slug: "No brief for <slug>. Run `brief-my-writer` first. Writing without a brief produces content nobody can defend at review."

## Procedure

1. Read the voice samples in `context/voice.md` before writing a sentence. Match their sentence-length distribution and paragraph rhythm, not a description of the voice.
2. Write to the brief's standalone claims first, then build the piece around them, so the extractable sentences are load-bearing rather than bolted on.
3. Every claim that is not common knowledge carries a proof id from the brief or a link. Unsourced claims get removed, not softened into a vaguer unsourced claim.
4. Use the quoted buyer language verbatim at least once in the first 200 words.
5. Include every internal link the brief named, from the source page the brief specified.
6. Run the slop check from `skills/_shared/voice-rules.md` against your own draft before returning it. Fix violations, then report what was fixed.

## Decision rules

- Never invent a number, a statistic, or a customer detail. If the brief did not supply it and it is not common knowledge, the sentence does not survive.
- The em-dash rule applies to your own output, not just to review comments about it.
- A draft that ignores a standalone claim from the brief is incomplete; go back and include it rather than noting the omission.

## Output

The draft itself, in Markdown, plus a short note:

```
Draft written: <word count> words.
Slop check: <passed / fixed n issues before returning>
Buyer language used: "<quote>" (first 200 words: yes/no)
Brief claims covered: <n> of <n>
```

## Done when

The slop check passes, every brief claim is covered or explicitly flagged as cut and why, the buyer-language quote appears early, and every internal link the brief named is present.
