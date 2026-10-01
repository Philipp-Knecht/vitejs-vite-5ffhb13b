import { z } from 'zod';

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Die E-Mail-Adresse ist zu lang.')
  .pipe(z.email('Bitte gib eine gültige E-Mail-Adresse ein.'));
