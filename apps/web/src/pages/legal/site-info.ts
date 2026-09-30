/** Operator details from build-time environment variables (see .env.example). */
function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\||\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const IMPRINT = {
  name: import.meta.env.VITE_IMPRINT_NAME?.trim() ?? '',
  address: lines(import.meta.env.VITE_IMPRINT_ADDRESS),
  email: import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '',
};

export const IMPRINT_COMPLETE = Boolean(
  IMPRINT.name && IMPRINT.address.length > 0 && IMPRINT.email,
);
