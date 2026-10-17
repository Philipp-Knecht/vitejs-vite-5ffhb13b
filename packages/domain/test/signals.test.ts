import { describe, expect, it } from 'vitest';
import {
  detectCategory,
  emptyParsedListing,
  extractDescriptionSignals,
  isNegated,
} from '../src/index';

const REF = new Date('2026-09-30T10:00:00Z');
const signals = (description: string, title: string | null = null) =>
  extractDescriptionSignals(description, title, REF);

describe('negation handling', () => {
  it.each([
    ['keine Kratzer oder Dellen', 'Dellen', true],
    ['Kein Rost vorhanden', 'Rost', true],
    ['ohne Mängel', 'Mängel', true],
    ['Mängel sind mir nicht bekannt', 'Mängel', true],
    ['Rost: keiner', 'Rost', true],
    ['keine Unfälle, aber Kratzer an der Tür', 'Kratzer', false],
    ['Kleine Kratzer an der Tür', 'Kratzer', false],
  ])('%s → negated(%s) = %s', (text, term, expected) => {
    const index = text.indexOf(term);
    expect(isNegated(text, index, term.length)).toBe(expected);
  });

  it('matches words starting with umlauts (Unicode word boundaries)', () => {
    expect(signals('Leichter Ölverlust am Getriebe.').damageMentions.map((m) => m.term)).toEqual([
      'Ölverlust',
    ]);
  });
});

describe('accident history', () => {
  it.each([
    ['Das Fahrzeug ist unfallfrei.', 'accident_free'],
    ['Kein Unfall, keine Vorschäden.', 'accident_free'],
    ['Nicht unfallfrei, Heckschaden wurde repariert.', 'previous_damage'],
    ['Hatte einen kleinen Parkrempler, repariert.', 'previous_damage'],
    ['Unfallschaden vorne rechts, noch nicht repariert.', 'unrepaired_damage'],
  ])('%s → %s', (text, expected) => {
    expect(signals(text).accident?.value).toBe(expected);
  });

  it('flags contradicting statements', () => {
    expect(
      signals('Unfallfrei! Leichter Vorschaden an der Tür wurde behoben.').accident,
    ).toMatchObject({
      value: 'previous_damage',
      conflicting: true,
    });
  });
});

describe('service history, owners and HU', () => {
  it.each([
    ['Scheckheftgepflegt bei BMW.', 'documented'],
    ['Alle Rechnungen vorhanden.', 'documented'],
    ['Wurde regelmäßig gewartet.', 'claimed'],
    ['Inspektion neu gemacht.', 'claimed'],
    ['Kein Serviceheft vorhanden.', 'none'],
    ['Nicht scheckheftgepflegt.', 'none'],
  ])('%s → %s', (text, expected) => {
    expect(signals(text).service?.value).toBe(expected);
  });

  it.each([
    ['Aus 2. Hand.', 2],
    ['Fahrzeug aus erster Hand.', 1],
    ['3 Vorbesitzer.', 3],
    ['Halter: 2', 2],
  ])('%s → %s owners', (text, expected) => {
    expect(signals(text).owners?.count).toBe(expected);
  });

  it('detects fresh HU claims and HU dates', () => {
    expect(signals('TÜV neu!').huNew).not.toBeNull();
    expect(signals('HU bis 08/2027, sonst alles gut.').huMention?.value).toEqual({
      year: 2027,
      month: 8,
    });
  });
});

describe('numeric mentions', () => {
  it('finds mileage statements anchored on keywords', () => {
    const found = signals(
      'Kilometerstand ca. 158.000 km. Zahnriemen bei 120.000 km gewechselt. 142 Tkm gelaufen.',
    );
    expect(found.mileageMentions.map((m) => m.km)).toEqual([158000, 142000]);
  });

  it('ignores yearly mileage and years', () => {
    expect(signals('Laufleistung 15.000 km pro Jahr. Seit 2015 gefahren.').mileageMentions).toEqual(
      [],
    );
  });

  it('reads power from title and description', () => {
    expect(
      signals('Motor mit 150 PS.', 'Golf 7 GTD 184 PS').powerMentions.map((m) => [m.source, m.ps]),
    ).toEqual([
      ['title', 184],
      ['description', 150],
    ]);
  });

  it('reads registration and build year', () => {
    const found = signals('EZ 05/2012, Baujahr 2011.');
    expect(found.registrationMentions[0]?.value).toEqual({ year: 2012, month: 5 });
    expect(found.buildYearMentions[0]?.year).toBe(2011);
  });

  it('reads anchored price statements only', () => {
    expect(
      signals('Neue Reifen für 800 € gekauft. Preis: 11.500 € VB.').priceMentions.map(
        (m) => m.amountEur,
      ),
    ).toEqual([11500]);
  });
});

describe('offer signals', () => {
  it('finds tuning, emission tampering and sold-as statements', () => {
    const found = signals('Chiptuning Stage 1, DPF entfernt. Nur für Bastler oder Export.');
    expect(found.tuningMentions.length).toBeGreaterThan(0);
    expect(found.emissionTampering.length).toBe(1);
    expect(found.soldAs.map((s) => s.kind).sort()).toEqual(['bastler', 'export']);
  });

  it('finds the warning signs for scams the police names', () => {
    const kinds = (text: string) => signals(text).scamSignals.map((s) => s.kind);
    const found: [string, string][] = [
      ['Zahlung per Vorkasse.', 'prepayment'],
      ['Der Betrag muss vorab überwiesen werden.', 'prepayment'],
      ['Zahlung im Voraus.', 'prepayment'],
      ['Bitte vorab zahlen.', 'prepayment'],
      ['Vorauszahlung erforderlich.', 'prepayment'],
      ['Anzahlung von 500 Euro, dann wird das Auto geliefert.', 'prepayment'],
      ['Lieferung nach Zahlungseingang.', 'prepayment'],
      ['Kein Tausch, keine Probefahrt, Zahlung per Vorkasse.', 'prepayment'],
      ['Bezahlung per Western Union.', 'prepayment'],
      ['Payment in advance only.', 'prepayment'],
      ['Ich bin derzeit beruflich in England.', 'abroad'],
      ['Ich wohne leider im Ausland.', 'abroad'],
      ['Bin gerade in Rumänien.', 'abroad'],
      ['Ich lebe jetzt mit meiner Familie in Spanien.', 'abroad'],
      ['Ich wurde nach England versetzt.', 'abroad'],
      ['Ich bin Soldat im Ausland.', 'abroad'],
      ['Die Lieferung erfolgt über eine Spedition.', 'shipping'],
      ['Ich schicke das Auto mit einem Speditionsunternehmen.', 'shipping'],
      ['Speditionskosten übernehme ich.', 'shipping'],
      ['Abwicklung über einen Treuhandservice.', 'escrow'],
      ['Treuhandgebühr trägt der Käufer.', 'escrow'],
      ['Abwicklung über einen Treuhänder.', 'escrow'],
      ['Kontakt nur per E-Mail, keine Anrufe.', 'offPlatform'],
      ['Bitte nur über WhatsApp schreiben.', 'offPlatform'],
      ['Ausschließlich per E-Mail erreichbar.', 'offPlatform'],
      ['Ich bin telefonisch nicht erreichbar, bitte per Mail.', 'offPlatform'],
    ];
    for (const [text, kind] of found) expect(kinds(text), text).toEqual([kind]);

    // Honest private and dealer listings stay quiet.
    for (const text of [
      'Keine Vorkasse, Barzahlung bei Abholung.',
      'Vorkasse ausgeschlossen, nur Barzahlung bei Übergabe.',
      'Vorkasse ist nicht möglich, nur Barzahlung.',
      'Vorkasse? Nein!',
      'Vorkasse lehne ich ab.',
      'Bitte nichts vorab überweisen.',
      'Treuhandservice? Nein danke!',
      'Betrüger mit Treuhand-Masche bitte nicht melden.',
      'Brief liegt bei der Bank, Ablösung erfolgt per Treuhandauftrag.',
      'Finanzierung ohne Anzahlung möglich. Lieferung bundesweit möglich.',
      'Reservierung gegen Anzahlung bei Bestellung.',
      'Überführung gegen Aufpreis. Export möglich.',
      'War Firmenwagen einer Spedition.',
      'Ich arbeite bei einer Spedition.',
      'Import aus den USA, 2022 nach Deutschland verschifft.',
      'Versand per Spedition nicht möglich.',
      'Das Fahrzeug wird Ihnen zugestellt, Bezahlung bei Übergabe in bar.',
      'Transporter mit Anhängerkupplung.',
      'Ich wohne in Hamburg, Besichtigung jederzeit.',
      'Ich bin in Polen geboren und wohne seit 20 Jahren in Berlin.',
      'Ich bin aktuell in Spanien im Urlaub, ab 25.10. wieder da.',
      'Da ich beruflich ins Ausland gehe, verkaufe ich mein Auto.',
      'Bei Fragen gerne per E-Mail oder telefonisch.',
      'Keine Anrufe von Händlern oder Exporteuren!',
      'Bitte keine Anrufe nach 20 Uhr.',
      'Bitte nur per Mail oder Telefon melden.',
      'Kontakt nur über WhatsApp oder Anruf.',
      'Bitte nur per SMS, ich rufe zurück.',
    ])
      expect(kinds(text), text).toEqual([]);
  });

  it('finds commercial wording and private-sale claims', () => {
    expect(
      signals('Finanzierung möglich, 12 Monate Gewährleistung.').commercialIndicators,
    ).toHaveLength(2);
    expect(signals('Privatverkauf, keine Garantie.').commercialIndicators).toHaveLength(0);
    expect(signals('Privatverkauf, keine Garantie.').privateSaleClaim).not.toBeNull();
  });

  it('finds transmission tokens, but not inside other words', () => {
    expect(signals('DSG schaltet sauber.').transmissionMentions.map((m) => m.value)).toEqual([
      'automatic',
    ]);
    expect(signals('Mit Klimaautomatik und Lichtautomatik.').transmissionMentions).toEqual([]);
  });

  it('finds positives', () => {
    const keys = signals(
      'Nichtraucherfahrzeug, Garagenwagen, Bremsen vorne neu, Sommer- und Winterreifen.',
    ).positives.map((p) => p.key);
    expect(keys).toEqual(['non_smoker', 'garage', 'new_brakes', 'second_tire_set']);
  });
});

describe('detectCategory', () => {
  const base = emptyParsedListing();

  it('trusts the Kleinanzeigen car category id', () => {
    expect(detectCategory(base, signals(''), '216')).toMatchObject({
      category: 'vehicle',
      vehicleKind: 'car',
    });
  });

  it('recognizes other vehicle kinds from the breadcrumb', () => {
    expect(
      detectCategory(
        { ...base, categoryHints: ['Auto, Rad & Boot', 'Motorräder & Motorroller'] },
        signals(''),
        null,
      ),
    ).toMatchObject({ vehicleKind: 'motorcycle' });
    expect(
      detectCategory({ ...base, categoryHints: ['Autoteile & Reifen'] }, signals(''), null),
    ).toMatchObject({
      vehicleKind: 'parts',
    });
  });

  it('recognizes cars from details or from a description', () => {
    const withDetails = {
      ...base,
      attributes: [
        { label: 'Kilometerstand', value: '100.000 km' },
        { label: 'Erstzulassung', value: '2015' },
        { label: 'Getriebe', value: 'Manuell' },
      ],
    };
    expect(detectCategory(withDetails, signals(''), null)).toMatchObject({ vehicleKind: 'car' });
    const description = 'Verkaufe meinen VW Polo, EZ 2014, 120.000 km gelaufen.';
    expect(detectCategory({ ...base, description }, signals(description), null)).toMatchObject({
      vehicleKind: 'car',
    });
  });

  it('does not treat other items as cars', () => {
    const description = 'Verkaufe mein iPhone 14 Pro, 256 GB, wie neu, mit Originalverpackung.';
    expect(
      detectCategory({ ...base, description }, signals(description), null).category,
    ).toBeNull();
  });
});

describe('vehicle identification number', () => {
  it.each([
    ['FIN: WVWZZZ1KZAW123456', true],
    ['Fahrgestellnummer wvwzzz1kzaw123456 auf Anfrage', true],
    ['Teilenummer 12345678901234567', false], // digits only
    ['Ausstattungspaket ABCDEFGHJKLMNPRST', false], // letters only
    ['Code WVWZZZ1KZAW12345O', false], // O is not allowed
    ['Code WVWZZZ1KZAW1234567', false], // 18 characters
  ])('%s → %s', (text, expected) => {
    expect(signals(text).vinMention !== null).toBe(expected);
  });
});
