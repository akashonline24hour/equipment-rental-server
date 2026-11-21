import { ObjectId } from "mongodb";

// Returns an ObjectId, or null when the text is not a valid id
export function toObjectId(id) {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id)
    ? new ObjectId(id)
    : null;
}

// Better Auth may store user ids as ObjectId or as text, so match both.
// Returns null when the id is not valid.
export function idFilter(id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  return { $or: [{ _id: objectId }, { _id: id }] };
}
