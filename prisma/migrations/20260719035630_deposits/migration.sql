-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertySlug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 2,
    "addons" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "depositCents" INTEGER,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "balanceDueAt" DATETIME,
    "balancePaidAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripePaymentMethodId" TEXT,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("addons", "amountCents", "approvedAt", "checkIn", "checkOut", "createdAt", "currency", "guests", "id", "note", "propertySlug", "status", "stripePaymentIntentId", "userId") SELECT "addons", "amountCents", "approvedAt", "checkIn", "checkOut", "createdAt", "currency", "guests", "id", "note", "propertySlug", "status", "stripePaymentIntentId", "userId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_propertySlug_status_idx" ON "Booking"("propertySlug", "status");
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
