import type {
  AdminUser,
  Conflict,
  OutboxItem,
  AvailabilityRule,
  BlockedDate,
  Booking,
  BookingEvent,
  Business,
  Customer,
  Message,
  Package,
  Payment,
  Review,
  Zone,
} from "@/lib/types";

export type NewRule = Omit<AvailabilityRule, "id" | "businessId">;
export type PackageInput = Omit<Package, "id" | "businessId"> & { id?: string };
export type ZoneInput = Omit<Zone, "id" | "businessId"> & { id?: string };

export interface BookingFilter {
  statuses?: Booking["status"][];
  /** Fecha local desde (incluida). */
  from?: string;
  /** Fecha local hasta (incluida). */
  to?: string;
  customerId?: string;
  needsAttention?: boolean;
}

export interface CapacityInput {
  businessId: string;
  date: string;
  start: Date;
  end: Date;
  guests: number;
  travelBufferMin: number;
  excludeBookingId?: string;
}

export interface CustomerRow extends Customer {
  bookingCount: number;
  lastEventDate: string | null;
}

/**
 * Lo único que las pantallas y los servicios saben de la base de datos. Hoy lo implementa
 * fakeStore (memoria); /replica-backend agrega la implementación con Postgres y no cambia
 * ninguna pantalla.
 */
export interface DataStore {
  readonly kind: "fake" | "postgres";

  getBusiness(): Promise<Business>;
  updateBusiness(id: string, patch: Partial<Omit<Business, "id">>): Promise<Business>;

  listRules(businessId: string): Promise<AvailabilityRule[]>;
  saveRules(businessId: string, rules: NewRule[]): Promise<void>;
  listBlockedDates(businessId: string): Promise<BlockedDate[]>;
  addBlockedDate(businessId: string, date: string, reason: string): Promise<BlockedDate>;
  removeBlockedDate(businessId: string, date: string): Promise<void>;

  listPackages(businessId: string): Promise<Package[]>;
  getPackage(businessId: string, id: string): Promise<Package | null>;
  savePackage(businessId: string, input: PackageInput): Promise<Package>;
  listZones(businessId: string): Promise<Zone[]>;
  getZone(businessId: string, id: string): Promise<Zone | null>;
  saveZone(businessId: string, input: ZoneInput): Promise<Zone>;

  getCustomer(businessId: string, id: string): Promise<Customer | null>;
  findCustomerByWhatsapp(businessId: string, whatsappE164: string): Promise<Customer | null>;
  insertCustomer(c: Omit<Customer, "id" | "createdAt">): Promise<Customer>;
  updateCustomer(businessId: string, id: string, patch: Partial<Omit<Customer, "id" | "businessId">>): Promise<Customer>;
  listCustomers(businessId: string, q?: string): Promise<CustomerRow[]>;

  /** Taquizas cuya fecha (o fecha propuesta) cae en el rango. Para capacidad y calendario. */
  listBookingsTouching(businessId: string, from: string, to: string): Promise<Booking[]>;
  listBookings(businessId: string, filter?: BookingFilter): Promise<Booking[]>;
  getBooking(businessId: string, id: string): Promise<Booking | null>;
  getBookingByCode(code: string): Promise<Booking | null>;
  findBookingByIdempotencyKey(businessId: string, key: string): Promise<Booking | null>;
  codeExists(code: string): Promise<boolean>;
  insertBooking(b: Omit<Booking, "createdAt" | "updatedAt">): Promise<Booking>;
  updateBooking(businessId: string, id: string, patch: Partial<Omit<Booking, "id" | "businessId">>): Promise<Booking>;
  countBookingsByCustomerSince(businessId: string, customerId: string, since: Date): Promise<number>;

  addEvent(e: Omit<BookingEvent, "id" | "createdAt">): Promise<void>;
  listEvents(bookingId: string): Promise<BookingEvent[]>;
  addMessage(m: Omit<Message, "id" | "createdAt">): Promise<void>;
  listMessages(bookingId: string): Promise<Message[]>;
  addPayment(p: Omit<Payment, "id" | "createdAt">): Promise<Payment>;
  updatePayment(id: string, patch: Partial<Omit<Payment, "id">>): Promise<Payment>;
  listPayments(bookingId: string): Promise<Payment[]>;
  findPayment(provider: Payment["provider"], providerRef: string): Promise<Payment | null>;
  findPaymentByCheckout(checkoutRef: string): Promise<Payment | null>;
  addReview(r: Omit<Review, "id" | "createdAt">): Promise<Review>;
  getReviewByBooking(bookingId: string): Promise<Review | null>;
  listReviews(businessId: string, opts?: { publishedOnly?: boolean }): Promise<Review[]>;
  setReviewPublished(businessId: string, id: string, published: boolean): Promise<void>;

  findAdminByEmail(email: string): Promise<AdminUser | null>;
  getAdmin(id: string): Promise<AdminUser | null>;
  bumpSessionVersion(adminId: string): Promise<void>;

  /** Enlaces mágicos: se guarda el hash; consumir es de un solo uso y atómico. */
  createLoginToken(adminId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeLoginToken(tokenHash: string): Promise<string | null>;

  /** Cuenta un intento en la ventana actual; false si ya se pasó del máximo. */
  hitRateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;

  /** Regla de capacidad decidida por la base (capacity_conflict en Postgres). Llamar dentro de withDayLock. */
  capacityConflict(input: CapacityInput): Promise<Conflict | null>;

  /** Avisos del proveedor de pagos: false si ese evento ya se había recibido. */
  recordWebhookEvent(provider: string, eventId: string, topic: string, payload: unknown): Promise<{ id: string; isNew: boolean; processed: boolean }>;
  markWebhookProcessed(id: string, error?: string | null): Promise<void>;
  findLatestPendingDeposit(bookingId: string): Promise<Payment | null>;

  enqueueOutbox(item: Pick<OutboxItem, "businessId" | "payload">): Promise<OutboxItem>;
  listDueOutbox(limit: number): Promise<OutboxItem[]>;
  updateOutbox(id: string, patch: Partial<Pick<OutboxItem, "attempts" | "nextAttemptAt" | "lastError" | "sentAt" | "deadAt">>): Promise<void>;
  listDeadOutbox(businessId: string): Promise<OutboxItem[]>;

  /** Borra contadores e enlaces de entrada viejos. Devuelve cuántas filas quitó. */
  purgeExpired(): Promise<number>;

  startJobRun(name: string): Promise<string>;
  finishJobRun(id: string, status: "ok" | "failed", detail: Record<string, unknown>, error?: string | null): Promise<void>;

  /**
   * Corre `fn` con el candado de esos días tomado (en orden, para no trabarse). En Postgres
   * es una transacción con pg_advisory_xact_lock; aquí, un candado en memoria.
   */
  withDayLock<T>(businessId: string, dates: string[], fn: () => Promise<T>): Promise<T>;
}
