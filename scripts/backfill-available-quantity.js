import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(process.env.DB_NAME || "equipment_rental");

  const result = await db
    .collection("equipment")
    .updateMany({ availableQuantity: { $exists: false } }, [
      { $set: { availableQuantity: "$quantity" } },
    ]);

  console.log(`Updated ${result.modifiedCount} equipment items.`);
} finally {
  await client.close();
}
