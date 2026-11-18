import { MongoClient } from "mongodb";

let client;
let dbPromise;

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
      .then(() => {
        console.log(`Connected to MongoDB (${dbName})`);
        return client.db(dbName);
      })
      .catch((err) => {
        dbPromise = undefined; // allow a retry on the next request
        throw err;
      });
  }

  return dbPromise;
}