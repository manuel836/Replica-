// Tipos del dominio. Siguen replica/schema.sql (nombres en camelCase).
// Fechas locales del negocio como "yyyy-MM-dd" y horas como "HH:mm"; instantes como Date (UTC).

export type BookingStatus =
  | "requested"
  | "awaiting_payment"
  | "confirmed"
  | "proposed"
  | "declined"
  | "cancelled_by_customer"
  | "cancelled_by_business"
  | "completed"
  | "no_show"
  | "expired";

export type DepositMode = "none" | "optional" | "required";
export type DepositType = "percent" | "fixed";
export type ConfirmationMode = "auto" | "manual";

export type TemplateKey =
  | "confirmed"
  | "declined"
  | "proposal"
  | "reminder"
  | "cancelled"
  | "review_request"
  | "payment_link"
  | "request_received";

export interface Business {
  id: string;
  slug: string;
  name: string;
  description: string;
  whatsappE164: string | null;
  email: string | null;
  city: string;
  timezone: string;
  currency: string;
  bookingCodePrefix: string;
  photoPaths: string[];
  depositMode: DepositMode;
  depositType: DepositType;
  /** Porcentaje 0-100, o centavos si depositType = "fixed". */
  depositValue: number;
  confirmationMode: ConfirmationMode;
  requestHoldHours: number;
  paymentHoldMinutes: number;
  proposalHoldHours: number;
  cancellationPolicy: string;
  refundCutoffDays: number;
  minNoticeDays: number;
  maxAdvanceDays: number;
  teams: number;
  whatsappTemplates: Partial<Record<TemplateKey, string>>;
}

export interface AvailabilityRule {
  id: string;
  businessId: string;
  /** 0 = domingo. */
  weekday: number;
  isOpen: boolean;
  firstStart: string;
  lastStart: string;
  slotIntervalMin: number;
  eventDurationMin: number;
  travelBufferMin: number;
  maxBookingsPerDay: number;
  maxGuestsPerDay: number | null;
}

export interface BlockedDate {
  id: string;
  businessId: string;
  date: string;
  reason: string;
}

export interface Package {
  id: string;
  businessId: string;
  name: string;
  description: string;
  photoPath: string | null;
  pricePerGuestCents: number;
  minGuests: number;
  maxGuests: number | null;
  includes: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface Zone {
  id: string;
  businessId: string;
  name: string;
  travelFeeCents: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  whatsappE164: string | null;
  email: string | null;
  notes: string;
  anonymizedAt: Date | null;
  createdAt: Date;
}

export interface Booking {
  id: string;
  businessId: string;
  code: string;
  manageTokenHash: string;
  manageTokenVersion: number;
  idempotencyKey: string | null;
  customerId: string;
  packageId: string;
  zoneId: string | null;
  eventDate: string;
  startAt: Date;
  endAt: Date;
  travelBufferMin: number;
  guests: number;
  address: string;
  neighborhood: string;
  addressNotes: string;
  eventType: string;
  customerNotes: string;
  internalNotes: string;
  pricePerGuestCents: number;
  subtotalCents: number;
  travelFeeCents: number;
  addonsCents: number;
  totalCents: number;
  depositCents: number;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  proposedStartAt: Date | null;
  proposedEndAt: Date | null;
  proposedEventDate: string | null;
  proposalExpiresAt: Date | null;
  source: "web" | "manual";
  capacityOverride: boolean;
  needsAttention: boolean;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentKind = "deposit" | "balance" | "refund";
export type PaymentMethod = "card" | "mp_wallet" | "oxxo" | "spei" | "cash" | "transfer";
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";

export interface Payment {
  id: string;
  businessId: string;
  bookingId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  provider: "mercadopago" | "stripe" | "manual";
  amountCents: number;
  status: PaymentStatus;
  checkoutRef: string | null;
  providerRef: string | null;
  refundOf: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export type BookingEventType =
  | "created"
  | "accepted"
  | "declined"
  | "proposed"
  | "proposal_accepted"
  | "proposal_rejected"
  | "rescheduled"
  | "cancelled"
  | "payment"
  | "refund"
  | "message"
  | "completed"
  | "no_show"
  | "expired"
  | "note";

export interface BookingEvent {
  id: string;
  businessId: string;
  bookingId: string;
  type: BookingEventType;
  actor: "customer" | "business" | "system";
  data: Record<string, unknown>;
  createdAt: Date;
}

export interface Message {
  id: string;
  businessId: string;
  bookingId: string;
  channel: "whatsapp" | "email";
  template: TemplateKey | "new_request_owner";
  mode: "link" | "api";
  status: "prepared" | "sent" | "delivered" | "failed";
  recipient: string;
  createdAt: Date;
}

export interface Review {
  id: string;
  businessId: string;
  bookingId: string;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt: Date;
}

export interface AdminUser {
  id: string;
  businessId: string;
  email: string;
  role: "owner" | "helper";
}

/** Motivo por el que un horario no cabe. Igual que capacity_conflict() en schema.sql. */
export type Conflict =
  | "date_mismatch"
  | "too_soon"
  | "too_far"
  | "blocked_date"
  | "closed_day"
  | "outside_hours"
  | "day_full"
  | "guests_full"
  | "time_taken";

export type DayState = "available" | "few" | "full" | "blocked" | "closed" | "out";
