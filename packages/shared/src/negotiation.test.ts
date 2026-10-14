import { describe, expect, it } from 'vitest';
import { buildNegotiationMessage, negotiationSuggestions, parseOfferEur } from './negotiation';
import type { Observation } from './schemas/analysis';
import type { Vehicle } from './schemas/listing';

const observation = (id: string, quotes: string[] = [], origin: 'rules' | 'ai' = 'rules') =>
  ({
    id,
    title: id,
    detail: '',
    severity: 'notice',
    evidence: 'listing_fact',
    origin,
    relatedFields: [],
    quotes,
  }) satisfies Observation;

const vehicle = (input: Partial<Vehicle>) =>
  ({ huUntil: null, serviceHistory: null, ...input }) as Vehicle;

describe('negotiationSuggestions', () => {
  it('turns HU, named defects and missing records into neutral points', () => {
    const suggestions = negotiationSuggestions(
      [
        observation('hu_expiring'),
        observation('damage_mentioned', ['Kleine Delle an der Heckklappe, sonst top.']),
        observation('mileage_conflict', ['120.000 km']),
      ],
      vehicle({ huUntil: { year: 2026, month: 12 }, serviceHistory: 'none' }),
    );
    expect(suggestions).toEqual([
      { id: 'hu_expiring', text: 'Die nächste HU ist schon 12/2026 fällig.' },
      {
        id: 'damage_mentioned:0',
        text: 'Wie im Inserat beschrieben: „Kleine Delle an der Heckklappe, sonst top.“',
      },
      { id: 'service_none', text: 'Es gibt keine Wartungsnachweise.' },
    ]);
  });

  it('keeps a typical quote whole, guards very long ones and ignores AI findings', () => {
    // A quote as the domain builds it: windowed around the defect, up to about 180 characters.
    const quote =
      'Scheckheftgepflegt bei VW, Zahnriemen und Wasserpumpe neu gewechselt, neue Bremsen vorne und hinten, Allwetterreifen fast neu, Klima läuft, kleine Delle an der Heckklappe';
    const long = `Unfallschaden ${'sehr '.repeat(60)}gut repariert 🚗`;
    const suggestions = negotiationSuggestions(
      [
        observation('damage_mentioned', [quote]),
        observation('damage_accident', [long]),
        observation('damage_rust', ['Rost'], 'ai'),
      ],
      vehicle({ serviceHistory: 'documented' }),
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]?.text).toContain('kleine Delle an der Heckklappe');
    const guarded = suggestions[1]?.text ?? '';
    expect(Array.from(guarded).length).toBeLessThanOrEqual(
      240 + Array.from('Wie im Inserat beschrieben: „“').length,
    );
    expect(guarded).toMatch(/…“$/);
    expect(guarded).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('lists a sentence with several defects only once', () => {
    const sentence =
      'Kratzer an der Stoßstange hinten, Beule an der Fahrertür, sonst guter Zustand.';
    const suggestions = negotiationSuggestions(
      [
        observation('damage_mentioned', [sentence, sentence]),
        observation('damage_body', [sentence]),
      ],
      vehicle({}),
    );
    expect(suggestions).toEqual([
      { id: 'damage_mentioned:0', text: `Wie im Inserat beschrieben: „${sentence}“` },
    ]);
  });

  it('needs the HU date for HU points', () => {
    expect(negotiationSuggestions([observation('hu_expired')], vehicle({}))).toEqual([]);
    expect(
      negotiationSuggestions(
        [observation('hu_expired')],
        vehicle({ huUntil: { year: 2025, month: null } }),
      ),
    ).toEqual([{ id: 'hu_expired', text: 'Die HU ist abgelaufen (gültig bis 2025).' }]);
  });
});

describe('buildNegotiationMessage', () => {
  it('asks an open question without an offer', () => {
    const message = buildNegotiationMessage({
      formal: true,
      vehicleTitle: 'VW Golf',
      points: ['Die Bremsscheiben sind verschlissen.', 'Es gibt keine Wartungsnachweise.'],
      offerEur: null,
    });
    expect(message).toBe(
      [
        'Hallo,',
        'vielen Dank, dass ich Ihr Fahrzeug „VW Golf“ ansehen konnte. Einige Punkte möchte ich noch ansprechen:',
        '1. Die Bremsscheiben sind verschlissen.\n2. Es gibt keine Wartungsnachweise.',
        'Diese Punkte muss ich nach dem Kauf erledigen lassen oder einplanen. Wie kommen Sie mir beim Preis entgegen? Alternativ könnten Sie Mängel vor der Übergabe beheben lassen.',
        'Viele Grüße',
      ].join('\n\n'),
    );
    expect(message).not.toMatch(/verschwiegen|Betrug/);
  });

  it('uses the buyer’s own offer and the informal address', () => {
    const message = buildNegotiationMessage({
      formal: false,
      vehicleTitle: null,
      points: ['Ein Reifen ist abgefahren.'],
      offerEur: 12500,
    });
    expect(message).toContain(
      'dass ich dein Auto ansehen konnte. Einen Punkt möchte ich noch ansprechen:',
    );
    expect(message).toContain(
      'Das muss ich nach dem Kauf erledigen lassen oder einplanen. Deshalb kann ich dir 12.500\u00a0€ anbieten.',
    );
  });
});

describe('parseOfferEur', () => {
  it.each<[string, number | null | undefined]>([
    ['', null],
    ['  ', null],
    ['12500', 12500],
    ['12.500', 12500],
    ['12 500 €', 12500],
    ['12.500,00', 12500],
    ['12.500,-', 12500],
    ['12.500.-', 12500],
    ['12.500 EUR', 12500],
    ['12500 Euro', 12500],
    ['0.500', undefined],
    ['1.250.000', 1250000],
    ['12,5', undefined],
    ['12.5', undefined],
    ['9999.99', undefined],
    ['0', undefined],
    ['-500', undefined],
    ['1e5', undefined],
    ['999.999.999', undefined],
  ])('%j → %j', (input, expected) => {
    expect(parseOfferEur(input)).toBe(expected);
  });
});
