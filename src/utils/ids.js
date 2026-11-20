import { ObjectId } from "mongodb";

// Returns an ObjectId, or null when the text is not a valid id
export function toObjectId(id) {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id)
    ? new ObjectId(id)
    : null;
}
