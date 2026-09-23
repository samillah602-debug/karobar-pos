import { applyCommand } from "./commands";
import { initialState, type StoreState } from "./model";

export class StoreUnavailableError extends Error {}
export type StoreQuery = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

// Revision checks prevent concurrent counters from selling the same stock.
export function createStoreBackend(
  query: StoreQuery,
  seed: () => StoreState = initialState,
) {
  async function readStore() {
    const select = "SELECT revision, payload FROM workspace WHERE id = $1";
    let row = (await query(select, ["main"])).rows[0];
    if (!row) {
      await query(
        "INSERT INTO workspace (id, revision, payload) VALUES ($1, 0, $2::jsonb) ON CONFLICT (id) DO NOTHING",
        ["main", JSON.stringify(seed())],
      );
      row = (await query(select, ["main"])).rows[0];
    }
    if (!row) throw new StoreUnavailableError("Could not load the store");
    return { revision: Number(row.revision), state: row.payload as StoreState };
  }

  async function writeCommand(
    action: string,
    payload: unknown,
    requestId: string,
  ) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const current = await readStore();
      const next = applyCommand(current.state, action, payload, requestId);
      if (next === current.state) return current;
      const updated = await query(
        "UPDATE workspace SET payload = $1::jsonb, revision = revision + 1, updated_at = now() WHERE id = $2 AND revision = $3 RETURNING revision",
        [JSON.stringify(next), "main", current.revision],
      );
      if (updated.rows.length === 1) {
        return { revision: Number(updated.rows[0].revision), state: next };
      }
    }
    throw new StoreUnavailableError(
      "Another counter updated this store. Please try again.",
    );
  }
  return { readStore, writeCommand };
}
