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
    // Cheap cars and price lines with a note are listings too.
    for (const price of [
      '850 € VB',
      '8450 €',
      'EUR 12.990',
      'Kaufpreis: 12.990 €',
      '12.990 € (Brutto)',
      '12.990 €¹',
      '16.990 € inkl. MwSt.',
      'Brutto 21.490 €',
      '€ 12.990,-',
    ])
      expect(looksLikePastedListing(listing.replace('8.700 €', price))).toBe(true);
    expect(looksLikePastedListing('Was kostet ein Golf mit 100.000 km für 8.000 €?')).toBe(false);
    // Questions with a price, a mileage and a registration in sentences are no listing.
    for (const question of [
      'Wir suchen ein Familienauto bis 15.000 €, höchstens 100.000 km, Erstzulassung ab 2018, gern Kombi mit Automatik. Was würdest du uns empfehlen und worauf sollten wir bei der Besichtigung achten?',
      'VW Golf 7 1.4 TSI\n120.000 km\n9.500 €\nEZ 2016\nLohnt sich das?\nWas meinst du dazu und was sollte ich fragen?',
      'Mein Auto: Opel Astra K, 2017, 90.000 km. Ich will es verkaufen, 8.000 € wären gut. Was muss ich beachten, und wie schreibe ich das Inserat am besten? Brauche ich einen Kaufvertrag?',
      'Ich suche einen VW Golf mit folgenden Wünschen:\nBudget:\n15.000 € maximal, gern weniger\nBaujahr ab 2018\nGetriebe Automatik\nKraftstoff Diesel oder Hybrid\nFarbe egal\nWas würdest du mir empfehlen?',
    ])
      expect(looksLikePastedListing(question)).toBe(false);
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
    // Words that only look like a topic.
    expect(topicJumps('Golf 7, Erstzulassung 2016 – typische Probleme?')[0]?.href).toBe('/modelle');
    expect(topicJumps('Ist die Steuerkette beim 1.4 TSI ein Problem?')[0]?.href).not.toBe(
      '/kfz-steuer-rechner',
    );
    expect(topicJumps('Ich versuche, mich zu entscheiden.')).toHaveLength(2);
    expect(topicJumps('Was kostet die Zulassung?')[0]?.href).toBe('/auto-ummelden');
    expect(topicJumps('Muss ich das Auto vor dem Verkauf abmelden?')[0]?.href).toBe(
      '/auto-ummelden',
    );
    expect(topicJumps('Wie melde ich das Auto aus Hamburg um?')[0]?.href).toBe('/auto-ummelden');
    const started = performance.now();
    topicJumps('melde '.repeat(3_333));
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('recognize a listing quickly also for a line made to slow the check down', () => {
    const lines = [
      'Ein sehr langer erster Satz, damit die Nachricht lang genug für die Prüfung wird, ganz harmlos.',
      'Kilometerstand 1',
      'Erstzulassung 2',
      'Leistung 3',
      'Getriebe 4',
      `12.990 € ${'inkl. '.repeat(14)}${'#'.repeat(40)}`,
      `12.990 € ${'inkl.'.repeat(11)}${'#'.repeat(20)}`,
    ];
    const started = performance.now();
    looksLikePastedListing(lines.join('\n'));
    expect(performance.now() - started).toBeLessThan(50);
  });
});
