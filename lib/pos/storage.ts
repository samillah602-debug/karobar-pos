import "server-only";
import { getPool } from "@/db";
import { initialState, sampleState } from "./model";
import { createStoreBackend, StoreUnavailableError } from "./storage-core";

const backend = createStoreBackend(
  async (sql, values) => {
    try {
      return await getPool().query(sql, values);
    } catch {
      console.error("Store database operation failed");
      throw new StoreUnavailableError(
        "The store is temporarily unavailable. Please try again.",
      );
    }
  },
  () => (process.env.POS_DEMO_DATA === "true" ? sampleState() : initialState()),
);

export const { readStore, writeCommand } = backend;
