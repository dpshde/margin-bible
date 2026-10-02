import { describe, expect, test } from "bun:test";
import { deletePasskey } from "../src/auth-store";

type Row = { library_id: string; credential_id: string };

function memoryDb(rows: Row[]): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (!sql.startsWith("DELETE FROM passkey_credentials")) throw new Error(sql);
              const [libraryId, credentialId] = args;
              const before = rows.length;
              for (let i = rows.length - 1; i >= 0; i -= 1) {
                const row = rows[i];
                if (row && row.library_id === libraryId && row.credential_id === credentialId) rows.splice(i, 1);
              }
              return { meta: { changes: before - rows.length } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("deletePasskey", () => {
  test("rejects an empty or oversized id without querying", async () => {
    const db = {
      prepare() {
        throw new Error("should not query");
      },
    } as unknown as D1Database;
    expect(await deletePasskey(db, "lib", "")).toBe(false);
    expect(await deletePasskey(db, "lib", "x".repeat(513))).toBe(false);
  });

  test("deletes only the matching credential on this library", async () => {
    const rows: Row[] = [
      { library_id: "lib-a", credential_id: "keep" },
      { library_id: "lib-a", credential_id: "drop" },
      { library_id: "lib-b", credential_id: "drop" },
    ];
    const db = memoryDb(rows);
    expect(await deletePasskey(db, "lib-a", "drop")).toBe(true);
    expect(await deletePasskey(db, "lib-a", "missing")).toBe(false);
    expect(rows).toEqual([
      { library_id: "lib-a", credential_id: "keep" },
      { library_id: "lib-b", credential_id: "drop" },
    ]);
  });
});
