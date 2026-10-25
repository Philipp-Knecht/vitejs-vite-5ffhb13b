import { describe, expect, it } from 'vitest';
import { createChatTools, looksLikePastedListing, topicJumps } from './chat-tools';

/** https://platform.claude.com/docs/en/build-with-claude/structured-outputs – schema complexity limits. */
const STRICT_LIMITS = { tools: 20, optionalParameters: 24, unionParameters: 16 };

interface Schema {
  properties?: Record<string, unknown>;
  required?: string[];
}

describe('chat tool schemas', () => {
  const specs = createChatTools({ analyses: {} as never, rdw: {} as never }).map(
    (tool) => tool.spec,
  );

  it('stay within what the API compiles for strict tools in one request', () => {
    const strict = specs.filter((spec) => spec.strict);
    const optional = strict.reduce((sum, spec) => {
      const schema = spec.inputSchema as Schema;
      const required = new Set(schema.required ?? []);
      return sum + Object.keys(schema.properties ?? {}).filter((key) => !required.has(key)).length;
    }, 0);
    const unions = strict.reduce(
      (sum, spec) =>
        sum + (JSON.stringify(spec.inputSchema).match(/"anyOf"|"type":\[/g)?.length ?? 0),
      0,
    );
    expect(strict.length).toBeLessThanOrEqual(STRICT_LIMITS.tools);
    expect(optional).toBeLessThanOrEqual(STRICT_LIMITS.optionalParameters);
    expect(unions).toBeLessThanOrEqual(STRICT_LIMITS.unionParameters);
  });

  it('close every object', () => {
    for (const spec of specs)
      expect(spec.inputSchema).toMatchObject({ additionalProperties: false });
  });

  it('recognize a pasted listing', () => {
    const listing = `Nissan Leaf\n8.700 €\nOhne Bewertung\nab 93 € mtl.\nFinanzierung berechnen\nKilometerstand 57.000 km\nErstzulassung 05/2021\nLeistung 110 kW (150 PS)\nKraftstoffart Elektro\nGetriebe Automatik\nFahrzeughalter 1\nStandort O Porriño, Spanien`;
    expect(looksLikePastedListing(listing)).toBe(true);
    expect(looksLikePastedListing('Was kostet ein Golf mit 100.000 km für 8.000 €?')).toBe(false);
    expect(looksLikePastedListing('Erzähl mir etwas über Autos. '.repeat(20))).toBe(false);
  });

  it('point to the page that fits a message', () => {
    expect(topicJumps('Lohnt sich ein Kredit für das Auto?')[0]?.href).toBe(
      '/kfz-steuer-rechner#finanzierung',
    );
    expect(topicJumps('Was muss ich bei der Probefahrt beachten?')[0]?.href).toBe(
      '/auto-besichtigung-checkliste',
    );
    expect(topicJumps('Hallo', 'Wie kann ich helfen?')).toHaveLength(2);
  });
});
