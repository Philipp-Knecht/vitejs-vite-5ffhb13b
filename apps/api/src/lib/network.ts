import net from 'node:net';

/** The eight groups of an IPv6 address, without leading zeros; null for anything else. */
function ipv6Groups(address: string): string[] | null {
  if (!net.isIPv6(address) || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(address)) return null;
  const plain = address.toLowerCase().split('%')[0]!;
  const [head = '', tail = ''] = plain.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = plain.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return groups.map((group) => group.replace(/^0+(?=.)/, ''));
}

/**
 * One subscriber: an IPv4 address, or the /64 network a device or line gets
 * with IPv6 – it can use any address in it.
 */
export function subscriberOf(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped?.[1]) return mapped[1];
  const groups = ipv6Groups(address);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : address;
}

/** The IPv6 /48 a line or server can rotate its /64 networks within; null for IPv4. */
export function blockOf(address: string): string | null {
  const groups = ipv6Groups(address);
  return groups ? `${groups.slice(0, 3).join(':')}::/48` : null;
}
