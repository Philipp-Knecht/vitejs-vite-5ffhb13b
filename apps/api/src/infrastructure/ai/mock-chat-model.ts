import type { ChatModel, ChatModelRequest, ChatModelTurn, ChatToolCall } from './chat-model';

/** "12.000" → 12000. */
const amount = (text: string | undefined) =>
  text === undefined ? undefined : Number(text.replace(/\./g, '').replace(',', '.'));

/**
 * A scripted stand-in for development and tests: fixed rules instead of a
 * language model, clearly marked as such. It calls the same tools as Claude.
 */
export class MockChatModel implements ChatModel {
  readonly model = 'mock-chat';
  readonly isMock = true;
  private calls = 0;

  private stream(request: ChatModelRequest, text: string): ChatModelTurn {
    // Small pieces, like a real stream.
    for (const piece of text.match(/.{1,24}/gs) ?? []) request.onText(piece);
    return { text, toolCalls: [], stop: 'end', fallback: false, raw: [{ type: 'text', text }] };
  }

  private use(name: string, input: Record<string, unknown>): ChatModelTurn {
    this.calls += 1;
    const call: ChatToolCall = { id: `mock_${this.calls}`, name, input };
    return {
      text: '',
      toolCalls: [call],
      stop: 'tool_use',
      fallback: false,
      raw: [{ type: 'tool_use', ...call }],
    };
  }

  turn(request: ChatModelRequest): Promise<ChatModelTurn> {
    const last = request.messages[request.messages.length - 1];
    if (last?.role === 'tool_results') {
      const [result] = last.results;
      const summary = (result?.content ?? '')
        .split('\n')
        .filter((line) =>
          /^(Empfehlung zum Preis|Kfz-Steuer|Kredit|Suche|Formular|Modell|RDW|Vorschläge)/.test(
            line,
          ),
        )
        .slice(0, 2)
        .join(' ');
      return Promise.resolve(
        this.stream(
          request,
          result?.isError
            ? `(Entwicklungsmodus) Das hat nicht geklappt: ${result.content}`
            : `(Entwicklungsmodus) ${summary || 'Erledigt.'}`,
        ),
      );
    }
    const text = last?.role === 'user' ? last.text : '';

    // A pasted listing KaufCheck already checked: the result follows the message.
    const checked =
      /\[KaufCheck (hat dieses Inserat schon geprüft|konnte dieses Inserat nicht prüfen)[^\n]*\n?([\s\S]*)\]$/.exec(
        text,
      );
    if (checked) {
      const summary = (checked[2] ?? '')
        .split('\n')
        .filter((line) => line.startsWith('Empfehlung zum Preis'))
        .join(' ');
      return Promise.resolve(
        this.stream(
          request,
          checked[1]?.startsWith('konnte')
            ? '(Entwicklungsmodus) Die Prüfung hat nicht geklappt.'
            : `(Entwicklungsmodus) ${summary || 'Geprüft.'}`,
        ),
      );
    }

    // A pasted listing: long, with the usual detail labels.
    if (text.length >= 200 && /kilometerstand|erstzulassung/i.test(text))
      return Promise.resolve(this.use('analyze_listing', {}));
    if (/finanzier/i.test(text)) {
      const price = amount(/kaufpreis\D{0,3}([\d.,]+)/i.exec(text)?.[1]);
      if (price === undefined) return Promise.resolve(this.use('show_form', { form: 'financing' }));
      const down = amount(/anzahlung\D{0,3}([\d.,]+)/i.exec(text)?.[1]);
      const months = amount(/laufzeit\D{0,3}(\d+)/i.exec(text)?.[1]);
      return Promise.resolve(
        this.use('financing', {
          price_eur: price,
          ...(down !== undefined ? { down_payment_eur: down } : {}),
          ...(months !== undefined ? { months } : {}),
        }),
      );
    }
    if (/steuer/i.test(text)) return Promise.resolve(this.use('show_form', { form: 'tax' }));
    if (/such|finde/i.test(text)) {
      const golf = /golf/i.test(text);
      return Promise.resolve(
        golf
          ? this.use('search_cars', { make: 'VW', model: 'Golf', price_max: 10_000 })
          : this.use('show_form', { form: 'search' }),
      );
    }
    if (/schwachstell/i.test(text))
      return Promise.resolve(this.use('model_info', { make: 'VW', model: 'Golf', year: 2014 }));
    if (/vertrag/i.test(text))
      return Promise.resolve(this.use('show_links', { pages: ['contract'] }));
    return Promise.resolve(
      this.stream(
        request,
        '(Entwicklungsmodus ohne KI) Ich bin der KaufCheck-Assistent. Füg einen Inseratstext ein oder frag nach Suche, Finanzierung, Steuer oder Schwachstellen.',
      ),
    );
  }
}
