import { describe, expect, it } from 'vitest';
import { blockOf, subscriberOf } from './network';

describe('network', () => {
  it('keeps an IPv4 address', () => {
    expect(subscriberOf('203.0.113.7')).toBe('203.0.113.7');
    expect(subscriberOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(blockOf('203.0.113.7')).toBeNull();
    expect(blockOf('::ffff:203.0.113.7')).toBeNull();
  });

  it('takes the /64 and the /48 of an IPv6 address', () => {
    expect(subscriberOf('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(subscriberOf('2001:0db8:0001:0002::1')).toBe('2001:db8:1:2::/64');
    expect(subscriberOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(subscriberOf('2001:DB8:1:2::5')).toBe(subscriberOf('2001:db8:1:2:ffff::'));
    expect(subscriberOf('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(blockOf('2001:db8:1:2::1')).toBe('2001:db8:1::/48');
  });
});
