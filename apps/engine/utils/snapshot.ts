import { Orderbook, Balance, Position } from "../stor/echangestore";

const SNAPSHOT_PATH = `${import.meta.dir}/../snapshot.json`;

// Flipped on while replaying input_stream history during recovery, so
// PublishEngineEvents (and index.ts's publishEvent) stay silent — those
// events already went out to events_stream before the crash.
export const replayState = { active: false };

function replacer(_key: string, value: unknown) {
  if (value instanceof Map) {
    return { __type: "Map", entries: Array.from(value.entries()) };
  }
  return value;
}

function reviver(_key: string, value: any) {
  if (value && typeof value === "object" && value.__type === "Map") {
    return new Map(value.entries);
  }
  return value;
}

export async function takeSnapshot(lastProcessedId: string) {
  const body = JSON.stringify(
    {
      lastProcessedId,
      orderbook: Orderbook,
      balance: Balance,
      position: Position,
    },
    replacer,
  );
  await Bun.write(SNAPSHOT_PATH, body);
}

// Returns the input_stream id the snapshot was taken at, or null if there's
// no snapshot file yet (first ever boot).
export async function loadSnapshot(): Promise<string | null> {
  const file = Bun.file(SNAPSHOT_PATH);
  if (!(await file.exists())) {
    return null;
  }
  const snapshot = JSON.parse(await file.text(), reviver) as {
    lastProcessedId: string;
    orderbook: Map<string, any>;
    balance: Map<string, any>;
    position: Map<string, any>;
  };

  for (const [market, book] of snapshot.orderbook) Orderbook.set(market, book);
  for (const [userId, bal] of snapshot.balance) Balance.set(userId, bal);
  for (const [userId, posMap] of snapshot.position) Position.set(userId, posMap);

  return snapshot.lastProcessedId;
}
