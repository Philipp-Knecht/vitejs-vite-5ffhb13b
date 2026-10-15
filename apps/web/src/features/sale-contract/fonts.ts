import boldUrl from './fonts/LiberationSans-Bold.ttf?url';
import regularUrl from './fonts/LiberationSans-Regular.ttf?url';
import type { ContractFonts } from './contract-pdf';

async function base64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  // In chunks: String.fromCharCode with one argument per byte would overflow the stack.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

let loading: Promise<ContractFonts> | null = null;

/** Liberation Sans for the contract PDF, loaded once the contract form is shown. */
export function loadContractFonts(): Promise<ContractFonts> {
  loading ??= Promise.all([base64(regularUrl), base64(boldUrl)]).then(([regular, bold]) => ({
    regular,
    bold,
  }));
  // A failed load (weak reception) is tried again next time.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
