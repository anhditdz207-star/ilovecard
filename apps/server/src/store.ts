import { DEFAULT_CHIPS } from "@cg/shared";

/** Chip ledger. In-memory for now; swap for Supabase impl (same interface) later. */
export interface ProfileStore {
  getChips(userId: string): Promise<number>;
  setChips(userId: string, chips: number): Promise<void>;
}

export class MemoryStore implements ProfileStore {
  private m = new Map<string, number>();
  async getChips(id: string) {
    return this.m.get(id) ?? DEFAULT_CHIPS;
  }
  async setChips(id: string, n: number) {
    this.m.set(id, Math.max(0, Math.floor(n)));
  }
}

export const store: ProfileStore = new MemoryStore();
