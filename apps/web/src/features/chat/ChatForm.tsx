import { CHAT_LIMITS, type ChatForm as ChatFormKind } from '@kaufcheck/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { FORM_TITLES } from './chat-labels';

type Prefill = Record<string, string | number>;

const text = (prefill: Prefill, key: string) =>
  prefill[key] === undefined ? '' : String(prefill[key]);

const euros = (value: string) => {
  const number = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number.toLocaleString('de-DE') : value;
};

/**
 * The fields the assistant asks for, right in the chat. Submitting sends one
 * message with all values, so the assistant can work without asking back.
 */
export function ChatForm({
  form,
  prefill,
  disabled,
  autoFocus,
  onSubmit,
}: {
  form: ChatFormKind;
  prefill: Prefill;
  disabled: boolean;
  autoFocus: boolean;
  onSubmit: (message: string) => void;
}) {
  const element = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (autoFocus) element.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [autoFocus]);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    make: text(prefill, 'make'),
    model: text(prefill, 'model'),
    price: text(prefill, 'price_eur'),
    down: text(prefill, 'down_payment_eur'),
    months: text(prefill, 'months') || '48',
    rate: '',
    registration: text(prefill, 'first_registration'),
    drive: 'petrol',
    ccm: '',
    co2: '',
    kw: '',
    year: '',
    km: '',
    zip: '',
    fuel: '',
    plate: text(prefill, 'plate'),
  }));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: string) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const field = (key: string) => ({
    value: values[key] ?? '',
    onChange: (event: { target: { value: string } }) => set(key)(event.target.value),
    disabled,
  });

  const message = (): string | null => {
    const v = values;
    switch (form) {
      case 'search': {
        const parts = [
          v.make && `Marke ${v.make}`,
          v.model && `Modell ${v.model}`,
          v.price && `bis ${euros(v.price)} €`,
          v.year && `Erstzulassung ab ${v.year}`,
          v.km && `bis ${euros(v.km)} km`,
          v.fuel && `Kraftstoff ${v.fuel}`,
          v.zip && `PLZ ${v.zip}`,
        ].filter(Boolean);
        return parts.length > 0 ? `Such mir ein Auto: ${parts.join(', ')}` : null;
      }
      case 'financing':
        if (!v.price) return null;
        return `Finanzierung berechnen: Kaufpreis ${euros(v.price)} €, Anzahlung ${euros(v.down || '0')} €, Laufzeit ${v.months} Monate${
          v.rate ? `, effektiver Jahreszins ${v.rate} %` : ''
        }`;
      case 'tax': {
        if (!v.registration) return null;
        const drive =
          { petrol: 'Benzin', diesel: 'Diesel', electric: 'Elektro' }[v.drive ?? ''] ?? '';
        const parts = [
          `Erstzulassung ${v.registration}`,
          `Antrieb ${drive}`,
          v.ccm && `Hubraum ${v.ccm} cm³`,
          v.co2 && `CO₂ ${v.co2} g/km`,
          v.make && `Marke ${v.make}`,
          v.model && `Modell ${v.model}`,
          v.kw && `Leistung ${v.kw} kW`,
        ].filter(Boolean);
        return `Kfz-Steuer berechnen: ${parts.join(', ')}`;
      }
      case 'rdw':
        return v.plate ? `Niederländisches Kennzeichen prüfen: ${v.plate}` : null;
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message();
    if (!text) {
      setProblem('Gib mindestens eine Angabe ein.');
      return;
    }
    if (text.length > CHAT_LIMITS.messageChars) {
      setProblem(
        `Der Text ist zu lang: höchstens ${CHAT_LIMITS.messageChars.toLocaleString('de-DE')} Zeichen.`,
      );
      return;
    }
    setProblem(null);
    onSubmit(text);
  };

  return (
    <form ref={element} className="chat-form" onSubmit={submit} aria-label={FORM_TITLES[form]}>
      <p className="chat-form__title">{FORM_TITLES[form]}</p>
      {form === 'search' && (
        <div className="chat-form__grid">
          <TextField label="Marke" {...field('make')} />
          <TextField label="Modell" {...field('model')} />
          <TextField label="Höchstpreis in €" inputMode="numeric" {...field('price')} />
          <TextField label="Erstzulassung ab" inputMode="numeric" {...field('year')} />
          <TextField label="Kilometer bis" inputMode="numeric" {...field('km')} />
          <SelectField label="Kraftstoff" {...field('fuel')}>
            <option value="">egal</option>
            <option value="Benzin">Benzin</option>
            <option value="Diesel">Diesel</option>
            <option value="Elektro">Elektro</option>
            <option value="Hybrid">Hybrid</option>
          </SelectField>
          <TextField label="PLZ" inputMode="numeric" maxLength={5} {...field('zip')} />
        </div>
      )}
      {form === 'financing' && (
        <div className="chat-form__grid">
          <TextField label="Kaufpreis in €" inputMode="numeric" required {...field('price')} />
          <TextField label="Anzahlung in €" inputMode="numeric" {...field('down')} />
          <SelectField label="Laufzeit" {...field('months')}>
            {[12, 24, 36, 48, 60, 72, 84].map((months) => (
              <option key={months} value={String(months)}>
                {months} Monate
              </option>
            ))}
          </SelectField>
          <TextField
            label="Effektiver Jahreszins in %"
            hint="Aus dem Angebot; leer lassen für den Durchschnittszins der Bundesbank."
            inputMode="decimal"
            {...field('rate')}
          />
        </div>
      )}
      {form === 'tax' && (
        <div className="chat-form__grid">
          <TextField
            label="Erstzulassung (MM/JJJJ)"
            placeholder="03/2016"
            required
            {...field('registration')}
          />
          <SelectField label="Antrieb" {...field('drive')}>
            <option value="petrol">Benzin, Autogas, Erdgas</option>
            <option value="diesel">Diesel</option>
            <option value="electric">Elektro</option>
          </SelectField>
          <TextField label="Hubraum in cm³ (P.1)" inputMode="numeric" {...field('ccm')} />
          <TextField label="CO₂ in g/km (V.7)" inputMode="numeric" {...field('co2')} />
          <TextField label="Marke (falls Werte fehlen)" {...field('make')} />
          <TextField label="Modell" {...field('model')} />
          <TextField label="Leistung in kW" inputMode="numeric" {...field('kw')} />
        </div>
      )}
      {form === 'rdw' && (
        <TextField
          label="Niederländisches Kennzeichen"
          placeholder="AB-123-C"
          required
          {...field('plate')}
        />
      )}
      {problem && (
        <p className="chat-form__problem" role="alert">
          {problem}
        </p>
      )}
      <Button type="submit" size="sm" disabled={disabled}>
        Absenden
      </Button>
    </form>
  );
}
