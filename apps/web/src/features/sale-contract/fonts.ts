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

/** Liberation Sans for the contract PDF, loaded only when a contract is created. */
export async function loadContractFonts(): Promise<ContractFonts> {
  const [regular, bold] = await Promise.all([base64(regularUrl), base64(boldUrl)]);
  return { regular, bold };
}
