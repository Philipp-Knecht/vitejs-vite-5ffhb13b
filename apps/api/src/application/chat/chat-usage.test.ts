import { describe, expect, it } from 'vitest';
import { connections } from './chat-usage';

const ids = (address: string) => connections(address).map((item) => item.id);

describe('connections', () => {
  it('keeps an IPv4 address', () => {
    expect(ids('203.0.113.7')).toEqual(['203.0.113.7']);
    expect(ids('::ffff:203.0.113.7')).toEqual(['203.0.113.7']);
  });

  it('takes the /64 and the /48 network of an IPv6 address', () => {
    expect(ids('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toEqual(['2001:db8:1:2', '2001:db8:1::/48']);
    expect(ids('2001:0db8:0001:0002::1')).toEqual(['2001:db8:1:2', '2001:db8:1::/48']);
    expect(ids('2001:db8::1')).toEqual(['2001:db8:0:0', '2001:db8:0::/48']);
    expect(ids('2001:DB8:1:2::5')).toEqual(ids('2001:db8:1:2:ffff::'));
    expect(ids('fe80::1%eth0')).toEqual(['fe80:0:0:0', 'fe80:0:0::/48']);
  });

  it('gives a /48 more room than a /64', () => {
    expect(connections('2001:db8:1:2::1').map((item) => item.factor)).toEqual([1, 5]);
  });
});
