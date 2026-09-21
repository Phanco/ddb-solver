import { TOTAL_SLOTS, holdMask, type HoldMask, type SlotIndex } from './types';

const EV_SCALE = 64;          // EV is stored in 1/64ths of a coin
const OCCUPIED = 0x80;        // bit 7 of byte 0

export class Table {
  #bytes: Uint8Array;

  private constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  static fromBytes(bytes: Uint8Array): Table {
    if (bytes.length !== TOTAL_SLOTS * 3) {
      throw new Error(`table size ${bytes.length}, expected ${TOTAL_SLOTS * 3}`);
    }
    return new Table(bytes);
  }

  static async load(url: string): Promise<Table> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
    return Table.fromBytes(new Uint8Array(await res.arrayBuffer()));
  }

  lookup(s: SlotIndex): { mask: HoldMask; ev: number } | null {
    const o = s * 3;
    const b0 = this.#bytes[o];
    if ((b0 & OCCUPIED) === 0) return null;
    const ev = (this.#bytes[o + 1] | (this.#bytes[o + 2] << 8)) / EV_SCALE;
    return { mask: holdMask(b0 & 0b11111), ev };
  }
}
