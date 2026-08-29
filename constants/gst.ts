// India GST rate slabs effective 22 September 2025: 0/5/18/40.
// Old 12% and 28% tiers are no longer valid for new invoices.
export const GST_RATES = [0, 5, 18, 40] as const;

export const GST_RATE_STRINGS = GST_RATES.map(String);
