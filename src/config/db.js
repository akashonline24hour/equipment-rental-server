import { MongoClient } from "mongodb";

let client;
let dbPromise;

async function ensureIndexes(db) {
  try {
    await db
      .collection("equipment")
      .createIndexes([
        { key: { ownerId: 1, createdAt: -1 } },
        { key: { status: 1, createdAt: -1 } },
      ]);
  } catch (err) {
    console.error("Could not create indexes:", err.message);
  }
}

// One shared connection, opened on the first request and reused afterwards.
// This works locally and on Vercel (serverless).
export function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "equipment_rental";

  if (!uri) throw new Error("MONGODB_URI is not set");

  if (!dbPromise) {
    client = new MongoClient(uri);
    dbPromise = client
      .connect()
      .then(async () => {
        const db = client.db(dbName);
        await ensureIndexes(db);
        console.log(`Connected to MongoDB (${dbName})`);
        return db;
      })
      .catch((err) => {
        dbPromise = undefined; // allow a retry on the next request
        throw err;
      });
  }

  return dbPromise;
}
