import { v4 as uuidv4 } from "uuid";
import { getDb, countTracks, insertTrack } from "@/lib/db";
import { SEED_TRACKS } from "@/lib/seed-data";

let seeded = false;

export function ensureSeeded() {
  if (seeded) return;
  getDb();

  if (countTracks() > 0) {
    seeded = true;
    return;
  }

  for (const track of SEED_TRACKS) {
    insertTrack({
      ...track,
      id: uuidv4(),
      createdAt: Date.now(),
    });
  }

  seeded = true;
  console.log(`[seed] Inserted ${SEED_TRACKS.length} demo tracks`);
}
