import "dotenv/config";
import { MongoClient } from "mongodb";

const ROLES = ["customer", "owner", "admin"];
const [emailArg, roleArg] = process.argv.slice(2);

if (!emailArg || !ROLES.includes(roleArg)) {
  console.log("Usage: npm run set-role -- <email> <customer|owner|admin>");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(process.env.DB_NAME || "equipment_rental");
  const email = emailArg.trim().toLowerCase();

  const result = await db.collection("user").updateOne(
    { email },
    {
      $set: {
        role: roleArg,
        requestedRole: "none",
        roleRequestStatus: "none",
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    console.error(
      `No user found with email ${email}. Register it on the website first.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`Done. ${email} is now: ${roleArg}`);
  }
} finally {
  await client.close();
}
