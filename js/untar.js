// Minimal ustar reader for a gzip-compressed tar already inflated to bytes.

function str(bytes, start, length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    const c = bytes[start + i];
    if (!c) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function octal(bytes, start, length) {
  const raw = str(bytes, start, length).trim();
  return raw ? parseInt(raw, 8) : 0;
}

export function untar(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    if (bytes[offset] === 0) break;
    const name = str(bytes, offset, 100);
    const size = octal(bytes, offset + 124, 12);
    const type = bytes[offset + 156];
    const prefix = str(bytes, offset + 345, 155);
    const full = prefix ? `${prefix}/${name}` : name;
    offset += 512;
    if (type === 0 || type === 48) {
      files.push({ name: full.replace(/^\.\//, ''), data: bytes.subarray(offset, offset + size) });
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

export async function ungzip(buffer) {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('Dieser Browser kann gzip nicht öffnen (DecompressionStream fehlt).');
}
