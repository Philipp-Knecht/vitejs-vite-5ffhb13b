import net from 'node:net';

/**
 * Addresses KaufCheck must never connect to: loopback, private networks,
 * link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast,
 * documentation/benchmark ranges and IPv6 transition ranges that can embed
 * such addresses. The policy fails closed.
 */
const blocked = new net.BlockList();
/**
 * IPv4-mapped IPv6 (::ffff:0:0/96) lives in its own list: Node's BlockList
 * compares IPv4 input against IPv4-mapped IPv6 rules, so this rule in the
 * main list would match every IPv4 address. It is only consulted for IPv6
 * input; a mapped answer is rejected outright (fail closed).
 */
const ipv4Mapped = new net.BlockList();
ipv4Mapped.addSubnet('::ffff:0:0', 96, 'ipv6');

const IPV4_BLOCKED: readonly [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV6_BLOCKED: readonly [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments, incl. Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
];

for (const [address, prefix] of IPV4_BLOCKED) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of IPV6_BLOCKED) blocked.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    // Zone ids ("fe80::1%eth0") are never public.
    if (address.includes('%')) return false;
    return !ipv4Mapped.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
  }
  return false;
}
