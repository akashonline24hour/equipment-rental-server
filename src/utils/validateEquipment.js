import { CATEGORIES, CONDITIONS, RENTAL_TYPES } from "./constants.js";

const clean = (value) => String(value ?? "").trim();

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Returns { errors, data }. Use data only when errors is empty.
export function validateEquipment(body = {}) {
  const errors = [];

  const data = {
    name: clean(body.name),
    description: clean(body.description),
    category: clean(body.category),
    location: clean(body.location),
    price: Math.round(Number(body.price) * 100) / 100,
    rentalType: clean(body.rentalType),
    quantity: Number(body.quantity),
    condition: clean(body.condition),
    brand: clean(body.brand),
    model: clean(body.model),
    image: clean(body.image),
    terms: clean(body.terms),
  };

  if (data.name.length < 3 || data.name.length > 100)
    errors.push("Name must be 3 to 100 characters");
  if (data.description.length < 20 || data.description.length > 2000)
    errors.push("Description must be 20 to 2000 characters");
  if (!CATEGORIES.includes(data.category))
    errors.push("Choose a valid category");
  if (data.location.length < 2 || data.location.length > 100)
    errors.push("Location must be 2 to 100 characters");
  if (!Number.isFinite(data.price) || data.price <= 0 || data.price > 100000)
    errors.push("Price must be more than 0 and at most 100000");
  if (!RENTAL_TYPES.includes(data.rentalType))
    errors.push("Choose a valid rental type");
  if (
    !Number.isInteger(data.quantity) ||
    data.quantity < 1 ||
    data.quantity > 1000
  )
    errors.push("Quantity must be a whole number from 1 to 1000");
  if (!CONDITIONS.includes(data.condition))
    errors.push("Choose a valid condition");
  if (data.brand.length < 1 || data.brand.length > 50)
    errors.push("Brand must be 1 to 50 characters");
  if (data.model.length < 1 || data.model.length > 50)
    errors.push("Model must be 1 to 50 characters");
  if (!isHttpsUrl(data.image))
    errors.push("Image must be a valid https:// link");
  if (data.terms.length < 10 || data.terms.length > 1500)
    errors.push("Rental terms must be 10 to 1500 characters");

  return { errors, data };
}
