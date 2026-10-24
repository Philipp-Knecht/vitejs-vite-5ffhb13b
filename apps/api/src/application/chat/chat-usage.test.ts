import { describe, expect, it } from 'vitest';
import { connection } from './chat-usage';

describe('connection', () => {
  it('keeps an IPv4 address', () => {
    expect(connection('203.0.113.7')).toBe('203.0.113.7');
    expect(connection('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('takes the /64 network of an IPv6 address', () => {
    expect(connection('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2');
    expect(connection('2001:0db8:0001:0002::1')).toBe('2001:db8:1:2');
    expect(connection('2001:db8::1')).toBe('2001:db8:0:0');
    expect(connection('2001:DB8:1:2::5')).toBe(connection('2001:db8:1:2:ffff::'));
  });
});
