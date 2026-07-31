import type { BlueprintNode } from './types.js';

export interface PermutationCheck {
  allowed: boolean;
  reasons: string[];
}

export interface PermutationInput {
  node: BlueprintNode;
  siblings: BlueprintNode[];
  /** Has measured demand: real impressions, or a SERP with a locally distinct top 3. */
  hasDemand: boolean;
  /** Proof id from strategy.json specific to this permutation. */
  hasProof: boolean;
  minSubstanceFields: number;
}

/**
 * The permutation guard from spec/site-blueprint.md section 4.
 *
 * `[service] in [area]` is how local and vertical businesses genuinely win,
 * and also how sites get classified as doorway pages and lose everything at
 * once. A permuted node is legal only when demand, substance, proof and
 * capacity all hold; failing any of them, the content becomes a section on
 * its parent rather than its own URL. This function is the deterministic
 * half: demand and proof are supplied by the caller, substance is enforced
 * here against every sibling, byte for byte.
 */
export function checkPermutation(input: PermutationInput): PermutationCheck {
  const reasons: string[] = [];

  if (!input.hasDemand) reasons.push('no measured demand for this permutation');
  if (!input.hasProof) reasons.push('no proof point specific to this permutation');

  const fields = input.node.substance_fields ?? {};
  const fieldCount = Object.keys(fields).length;
  if (fieldCount < input.minSubstanceFields) {
    reasons.push(
      `only ${fieldCount} substance field(s) declared, needs ${input.minSubstanceFields}`,
    );
  } else {
    for (const sibling of input.siblings) {
      const siblingFields = sibling.substance_fields ?? {};
      const identical = Object.keys(fields).filter(
        (key) => key in siblingFields && siblingFields[key] === fields[key],
      );
      // Every substance field must differ from every sibling's, not just some
      // of them. A page that only swaps the area name while repeating every
      // other fact is a doorway page with one word changed.
      if (identical.length > 0) {
        reasons.push(
          `shares ${identical.join(', ')} identically with sibling ${sibling.id}`,
        );
      }
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
