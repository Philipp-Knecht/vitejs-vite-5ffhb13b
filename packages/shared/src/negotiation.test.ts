import { describe, expect, it } from 'vitest';
import { buildNegotiationMessage, negotiationSuggestions } from './negotiation';
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
        text: 'Im Inserat genannt: „Kleine Delle an der Heckklappe, sonst top.“',
      },
      { id: 'service_none', text: 'Es gibt keine Wartungsnachweise.' },
    ]);
  });

  it('shortens long quotes and ignores AI findings', () => {
    const long = `Unfallschaden vorne links ${'sehr '.repeat(40)}gut repariert`;
    const suggestions = negotiationSuggestions(
      [observation('damage_accident', [long]), observation('damage_rust', ['Rost'], 'ai')],
      vehicle({ serviceHistory: 'documented' }),
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.text.length).toBeLessThanOrEqual(120 + 'Im Inserat genannt: „“'.length);
    expect(suggestions[0]?.text).toMatch(/…“$/);
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
        'vielen Dank, dass ich Ihr Fahrzeug „VW Golf“ ansehen konnte. Dabei sind mir einige Punkte aufgefallen:',
        '1. Die Bremsscheiben sind verschlissen.\n2. Es gibt keine Wartungsnachweise.',
        'Diese Punkte muss ich nach dem Kauf erledigen lassen oder einplanen. Wie kommen Sie mir beim Preis entgegen? Alternativ könnten Sie die Punkte vor der Übergabe erledigen lassen.',
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
      'dass ich dein Auto ansehen konnte. Dabei ist mir ein Punkt aufgefallen:',
    );
    expect(message).toContain(
      'Das muss ich nach dem Kauf erledigen lassen oder einplanen. Deshalb kann ich dir 12.500 € anbieten.',
    );
  });
});
