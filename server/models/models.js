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
}, { timestamps: true, strict: false });

const UserSchema = new Schema({
  role: { type: String, enum: ["client", "agency", "admin"] },
  agentRole: String, // "supervisor" | "agent" — agency accounts only
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  agencyId: String,
  status: { type: String, default: "active" }, // "active" | "suspended"
  mustChangePassword: Boolean,
  // Lien « mot de passe oublié » : empreinte SHA-256 du jeton envoyé par e-mail + date d'expiration
  resetTokenHash: { type: String, index: true },
  resetTokenExpires: Date,
  // Connexion en deux étapes (code par e-mail) — empreintes uniquement.
  otpChallengeHash: { type: String, index: true },
  otpCodeHash: String,
  otpExpires: Date,
  otpTries: Number,
  otpResends: Number,
  otpSentAt: Date,
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

// Facture mensuelle d'abonnement d'une agence à la plateforme (payée par mobile money
// via la passerelle, ou enregistrée manuellement par l'administration).
const InvoiceSchema = new Schema({
  id: { type: String, unique: true },
  agencyId: String,
  period: String, // "AAAA-MM"
  amount: Number,
  status: String, // pending | trial | paid
  method: String,
  paidAt: String,
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

// Alertes « nouveaux biens » : un visiteur enregistre ses critères et reçoit
// les nouvelles annonces correspondantes (e-mail ; WhatsApp si configuré).
const AlertSchema = new Schema({
  id: { type: String, unique: true },
  email: { type: String, index: true },
  phone: String,                 // format international, ex. +221771234567 (facultatif)
  criteria: {
    kind: String,                // rent | sale | short | (vide = tous)
    type: String,                // apartment | house | office | land
    hood: String,
    hoodLabel: String,
    minBeds: Number,
    maxPrice: Number,
  },
  lang: { type: String, default: "fr" },
  confirmed: { type: Boolean, default: false },   // double opt-in par e-mail
  active: { type: Boolean, default: true },
  tokenHash: { type: String, index: true },       // lien de confirmation / désinscription
  sentToday: { type: Number, default: 0 },
  sentDay: String,
  lastSentAt: Date,
}, { timestamps: true });

// Signature électronique des contrats : code à 6 chiffres envoyé par e-mail.
// Seules des empreintes sont stockées ; le document expire tout seul (index TTL).
const SignCodeSchema = new Schema({
  challengeHash: { type: String, index: true },
  codeHash: String,
  bookingId: String,
  contractId: String,
  userId: String,
  tries: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } },
}, { timestamps: true });

module.exports = {
  SignCode: mongoose.model("SignCode", SignCodeSchema),
  Alert: mongoose.model("Alert", AlertSchema),
  Property: mongoose.model("Property", PropertySchema),
  User: mongoose.model("User", UserSchema),
  Agency: mongoose.model("Agency", AgencySchema),
  Booking: mongoose.model("Booking", BookingSchema),
  Message: mongoose.model("Message", MessageSchema),
  Review: mongoose.model("Review", ReviewSchema),
  Payment: mongoose.model("Payment", PaymentSchema),
  Invoice: mongoose.model("Invoice", InvoiceSchema),
  Favorite: mongoose.model("Favorite", FavoriteSchema),
  Announcement: mongoose.model("Announcement", AnnouncementSchema),
};
