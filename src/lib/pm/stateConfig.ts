/**
 * State-specific defaults for PM company onboarding.
 *
 * Driven by data, not code — workflows read from here so adding a new state
 * later is a single-table change. Covers FL / MN / VA for MVP.
 *
 * IMPORTANT: Values here are reasonable defaults, not legal advice. The
 * onboarding workflow presents them as editable suggestions; the user (or
 * their counsel) owns the final numbers.
 */

import type { UsStateCode } from "../data/types";

export interface StateDefaults {
  state: UsStateCode;
  displayName: string;
  /** Default management fee as a percent of monthly rent. */
  managementFeePercent: number;
  /** Default leasing fee in months of rent. */
  leasingFeeMonthsOfRent: number;
  /** Default late fee grace period in days. */
  lateFeeGraceDays: number;
  /** Maximum security deposit as a multiplier of monthly rent (guideline). */
  maxSecurityDepositMultiplier: number | null;
  /** State-required disclosures the onboarding compliance check looks for. */
  requiredDisclosures: string[];
  /** Notes the onboarding workflow can surface to the user. */
  notes: string[];
}

const TABLE: Record<UsStateCode, StateDefaults> = {
  FL: {
    state: "FL",
    displayName: "Florida",
    managementFeePercent: 10,
    leasingFeeMonthsOfRent: 1,
    lateFeeGraceDays: 3,
    maxSecurityDepositMultiplier: null, // FL has no statutory cap
    requiredDisclosures: [
      "Radon gas disclosure",
      "Lead-based paint (pre-1978 properties)",
      "Security deposit handling notice",
      "Fire protection disclosure (if applicable)",
    ],
    notes: [
      "Florida requires landlords to hold security deposits in a separate FL bank account or post a surety bond.",
      "Trust accounting: operating funds must be kept separate from tenant deposits.",
    ],
  },
  MN: {
    state: "MN",
    displayName: "Minnesota",
    managementFeePercent: 8,
    leasingFeeMonthsOfRent: 1,
    lateFeeGraceDays: 0, // MN has no statutory grace; caps late fee at 8%
    maxSecurityDepositMultiplier: null,
    requiredDisclosures: [
      "Lead-based paint (pre-1978 properties)",
      "Disclosure of financial interest in utilities",
      "Carbon monoxide alarm notice",
    ],
    notes: [
      "Minnesota caps late fees at 8% of the overdue amount.",
      "Security deposits must earn simple interest at 1% per annum, paid at move-out.",
    ],
  },
  VA: {
    state: "VA",
    displayName: "Virginia",
    managementFeePercent: 9,
    leasingFeeMonthsOfRent: 0.75,
    lateFeeGraceDays: 5,
    maxSecurityDepositMultiplier: 2,
    requiredDisclosures: [
      "Lead-based paint (pre-1978 properties)",
      "Mold disclosure",
      "Defective drywall disclosure (if applicable)",
      "Military air installation disclosure (if in affected zone)",
    ],
    notes: [
      "Virginia caps late fees at 10% of the monthly rent or 10% of the balance due, whichever is less.",
      "Security deposit capped at 2 months' rent for dwellings under VRLTA.",
    ],
  },
};

export function getStateDefaults(state: UsStateCode): StateDefaults {
  return TABLE[state];
}

export function listSupportedStates(): StateDefaults[] {
  return Object.values(TABLE);
}
