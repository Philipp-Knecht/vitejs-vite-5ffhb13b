/** „1.234 €“, or with cents. */
export const euros = (value: number, fractions = 0) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  });
