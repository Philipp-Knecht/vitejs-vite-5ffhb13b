import { describe, expect, it } from 'vitest';
import { createChatTools } from './chat-tools';

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
});
