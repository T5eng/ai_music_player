import { v4 as uuidv4 } from "uuid";
import { getDb, countTracks, insertTrack } from "@/lib/db";
import { SEED_TRACKS } from "@/lib/seed-data";

function seed() {
  getDb();

  if (countTracks() > 0) {
    console.log(`Database already has ${countTracks()} tracks, skipping seed.`);
    return;
  }

  console.log("Seeding database with demo tracks...");
  for (const track of SEED_TRACKS) {
    insertTrack({
      ...track,
      id: uuidv4(),
      createdAt: Date.now(),
    });
  }
  console.log(`Seeded ${SEED_TRACKS.length} tracks.`);
}

seed();
