import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { remoteUrlSchema } from "./schemas";
import { ImportError } from "./errors";
const blocked4 = new BlockList();
for (const [address, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["192.88.99.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",3]] as const) blocked4.addSubnet(address,bits,"ipv4");
const global6 = new BlockList(), blocked6 = new BlockList(); global6.addSubnet("2000::",3,"ipv6");
for (const [address,bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const) blocked6.addSubnet(address,bits,"ipv6");
export function isPublicAddress(address: string) {
  return isIP(address) === 4 ? !blocked4.check(address,"ipv4") : isIP(address) === 6 && global6.check(address,"ipv6") && !blocked6.check(address,"ipv6");
}
export function publicUrl(value: string) {
  const parsed = remoteUrlSchema.safeParse(value); if (!parsed.success) throw new ImportError("invalid_url");
  const url = new URL(parsed.data), host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(host) ? !isPublicAddress(host) : !host.includes(".") || /(?:^|\.)(localhost|local|internal|lan|home|test|invalid|onion|example)$/.test(host) || /(?:^|\.)(metadata|metadata\.google\.internal)$/.test(host)) throw new ImportError("blocked");
  return url;
}
export type Resolver = (host: string) => Promise<{address: string; family: number}[]>;
const resolve: Resolver = host => lookup(host,{all:true,verbatim:true});
export async function resolvePublic(value: string, resolver: Resolver = resolve) {
  const url = publicUrl(value), host = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = isIP(host) ? [{address:host,family:isIP(host)}] : await Promise.race([resolver(host),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ImportError("timeout")),5000);})]);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new ImportError("blocked");
    return {url,address:addresses.find(item=>item.family===4) ?? addresses[0]};
  } catch(error) { throw error instanceof ImportError ? error : new ImportError("blocked"); }
  finally { clearTimeout(timer); }
}
