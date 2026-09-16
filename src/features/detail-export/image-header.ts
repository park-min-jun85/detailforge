import { ExportError } from "./errors";
export function imageDimensions(bytes: Uint8Array, format: "png" | "jpg") {
  const data = Buffer.from(bytes);
  if (format === "png" && data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString("ascii", 12, 16) === "IHDR") return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (format === "jpg" && data[0] === 255 && data[1] === 216) {
    let offset = 2;
    while (offset + 4 <= data.length) {
      if (data[offset++] !== 255) break;
      const marker = data[offset++], length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
      offset += length;
    }
  }
  throw new ExportError("screenshot");
}
