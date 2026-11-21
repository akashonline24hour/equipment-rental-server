import "dotenv/config";
import { MongoClient } from "mongodb";

const REVIEWS = [
  {
    name: "Rahim Uddin",
    title: "Event organizer",
    rating: 5,
    comment:
      "I rented sound and lighting gear for a corporate event. Everything arrived on time and worked perfectly.",
  },
  {
    name: "Nusrat Jahan",
    title: "Wedding photographer",
    rating: 5,
    comment:
      "The camera kit was in great condition and the owner was easy to reach. Booking took only a few minutes.",
  },
  {
    name: "Tanvir Ahmed",
    title: "Site engineer",
    rating: 4,
    comment:
      "I found a compact excavator nearby at a fair daily rate. Payment was smooth and the terms were clear.",
  },
  {
    name: "Farhana Akter",
    title: "Small business owner",
    rating: 5,
    comment:
      "We rent projectors and laptops for every workshop we run. It is far cheaper than buying them.",
  },
  {
    name: "Imran Hossain",
    title: "Farmer",
    rating: 4,
    comment:
      "I rented a power tiller for the planting season. Good price, and the owner explained how to use it.",
  },
  {
    name: "Sadia Rahman",
    title: "Videographer",
    rating: 5,
    comment:
      "Clear listings, honest conditions and quick support. I will keep renting from RentGear.",
  },
];

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(process.env.DB_NAME || "equipment_rental");
  const reviews = db.collection("reviews");

  const existing = await reviews.countDocuments();
  if (existing > 0) {
    console.log(
      `The reviews collection already has ${existing} reviews. Nothing was added.`,
    );
  } else {
    const now = Date.now();
    await reviews.insertMany(
      REVIEWS.map((review, index) => ({
        ...review,
        createdAt: new Date(now - index * 24 * 60 * 60 * 1000),
      })),
    );
    console.log(`Added ${REVIEWS.length} reviews.`);
  }
} finally {
  await client.close();
}
