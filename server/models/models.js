const mongoose = require("mongoose");
const { Schema } = mongoose;

const PropertySchema = new Schema({
  id: { type: String, unique: true },
  type: String, // apartment | house | office
  forSale: Boolean,
  shortStay: Boolean,
  title: String,
  titleEn: String,
  neighborhood: String,
  price: Number,
  bedrooms: Number,
  bathrooms: Number,
  area: Number,
  agencyId: String,
  furnished: Boolean,
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  desc: String,
  descEn: String,
  photos: [String],
  cover: String,
  tourPanels: [String],
  lat: Number,
  lng: Number,
}, { timestamps: true });

const UserSchema = new Schema({
  role: { type: String, enum: ["client", "agency", "admin"] },
  agentRole: String, // "supervisor" | "agent" — agency accounts only
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  agencyId: String,
  status: { type: String, default: "active" }, // "active" | "suspended"
}, { timestamps: true, strict: false });

// strict:false — the agency object carries many evolving fields (welcome
// kit, sub-site settings, logo, subscription info...); rather than
// re-declaring each one here and risking silently dropping a field the
// frontend actually sends, let Mongoose persist whatever it's given.
const AgencySchema = new Schema({
  id: { type: String, unique: true },
  name: String,
  email: String,
  phone: String,
  status: { type: String, default: "active" },
}, { timestamps: true, strict: false });

const BookingSchema = new Schema({
  id: { type: String, unique: true },
  propertyId: String,
  propertyTitle: String,
  agencyId: String,
  userId: String,
  checkin: String,
  checkout: String,
  name: String,
  phone: String,
  email: String,
  message: String,
  price: Number,
  status: { type: String, default: "pending" },
}, { timestamps: true, strict: false });

const MessageSchema = new Schema({
  id: { type: String, unique: true },
  propertyId: String,
  propertyTitle: String,
  agencyId: String,
  userId: String,
  userName: String,
  from: String, // "client" | "agency"
  text: String,
}, { timestamps: true, strict: false });

const ReviewSchema = new Schema({
  id: { type: String, unique: true },
  propertyId: String,
  userId: String,
  userName: String,
  rating: Number,
  comment: String,
  approved: { type: Boolean, default: true },
}, { timestamps: true, strict: false });

const PaymentSchema = new Schema({
  id: { type: String, unique: true },
  propertyId: String,
  propertyTitle: String,
  userId: String,
  amount: Number,
  method: String,
  status: String,
}, { timestamps: true, strict: false });

const AnnouncementSchema = new Schema({
  id: { type: String, unique: true },
  agencyId: String,
  propertyId: String,
  title: String,
  text: String,
}, { timestamps: true, strict: false });

const FavoriteSchema = new Schema({
  userId: String,
  propertyId: String,
});

module.exports = {
  Property: mongoose.model("Property", PropertySchema),
  User: mongoose.model("User", UserSchema),
  Agency: mongoose.model("Agency", AgencySchema),
  Booking: mongoose.model("Booking", BookingSchema),
  Message: mongoose.model("Message", MessageSchema),
  Review: mongoose.model("Review", ReviewSchema),
  Payment: mongoose.model("Payment", PaymentSchema),
  Favorite: mongoose.model("Favorite", FavoriteSchema),
  Announcement: mongoose.model("Announcement", AnnouncementSchema),
};
