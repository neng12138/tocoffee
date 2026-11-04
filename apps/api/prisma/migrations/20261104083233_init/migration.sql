-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "category_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ON_SALE', 'SOLD_OUT', 'OFF_SHELF');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'READY', 'COMPLETED', 'NO_SHOW', 'CANCELED', 'REFUNDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "pickup_type" AS ENUM ('SELF_PICKUP');

-- CreateEnum
CREATE TYPE "pickup_time_type" AS ENUM ('ASAP', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('MOCK', 'WECHAT');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "business_hours" JSONB NOT NULL,
    "is_accepting_orders" BOOLEAN NOT NULL DEFAULT true,
    "prep_minutes" INTEGER NOT NULL DEFAULT 8,
    "per_order_minutes" INTEGER NOT NULL DEFAULT 2,
    "pickup_notice" TEXT,
    "pickup_code_prefix" VARCHAR(4) NOT NULL DEFAULT 'A',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "role" "staff_role" NOT NULL DEFAULT 'STAFF',
    "status" "staff_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20),
    "openid" VARCHAR(64),
    "nickname" VARCHAR(50),
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "category_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(500),
    "base_price_cents" INTEGER NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "product_status" NOT NULL DEFAULT 'ON_SALE',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_groups" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "multi_select" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER NOT NULL DEFAULT 1,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "spec_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_options" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "price_delta_cents" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "spec_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_spec_groups" (
    "product_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_spec_groups_pkey" PRIMARY KEY ("product_id","group_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" VARCHAR(32) NOT NULL,
    "store_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "pickup_type" "pickup_type" NOT NULL DEFAULT 'SELF_PICKUP',
    "pickup_time_type" "pickup_time_type" NOT NULL DEFAULT 'ASAP',
    "scheduled_at" TIMESTAMPTZ(3),
    "release_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "pickup_code" VARCHAR(8),
    "business_date" DATE NOT NULL,
    "items_amount_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "payable_cents" INTEGER NOT NULL,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "coupon_id" UUID,
    "remark" VARCHAR(255),
    "contact_name" VARCHAR(50),
    "contact_phone" VARCHAR(20),
    "estimated_ready_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "idempotency_key" VARCHAR(64),
    "cancel_reason" VARCHAR(255),
    "paid_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "ready_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "no_show_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(80) NOT NULL,
    "product_image" VARCHAR(500),
    "spec_snapshot" JSONB NOT NULL,
    "spec_text" VARCHAR(255) NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "remark" VARCHAR(255),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "transaction_id" VARCHAR(64),
    "amount_cents" INTEGER NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "provider_refund_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_counters" (
    "store_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pickup_counters_pkey" PRIMARY KEY ("store_id","business_date")
);

-- CreateIndex
CREATE INDEX "staff_store_id_status_idx" ON "staff"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_store_id_username_key" ON "staff"("store_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "members_openid_key" ON "members"("openid");

-- CreateIndex
CREATE INDEX "verification_codes_phone_created_at_idx" ON "verification_codes"("phone", "created_at");

-- CreateIndex
CREATE INDEX "categories_store_id_sort_idx" ON "categories"("store_id", "sort");

-- CreateIndex
CREATE INDEX "products_store_id_category_id_status_sort_idx" ON "products"("store_id", "category_id", "status", "sort");

-- CreateIndex
CREATE INDEX "spec_groups_store_id_sort_idx" ON "spec_groups"("store_id", "sort");

-- CreateIndex
CREATE INDEX "spec_options_group_id_sort_idx" ON "spec_options"("group_id", "sort");

-- CreateIndex
CREATE INDEX "product_spec_groups_group_id_idx" ON "product_spec_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_store_id_status_created_at_idx" ON "orders"("store_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_store_id_business_date_idx" ON "orders"("store_id", "business_date");

-- CreateIndex
CREATE INDEX "orders_store_id_pickup_time_type_released_at_idx" ON "orders"("store_id", "pickup_time_type", "released_at");

-- CreateIndex
CREATE INDEX "orders_store_id_scheduled_at_idx" ON "orders"("store_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "orders_member_id_created_at_idx" ON "orders"("member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_member_id_idempotency_key_key" ON "orders"("member_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider", "transaction_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_groups" ADD CONSTRAINT "spec_groups_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "spec_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_groups" ADD CONSTRAINT "product_spec_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_groups" ADD CONSTRAINT "product_spec_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "spec_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_counters" ADD CONSTRAINT "pickup_counters_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual constraints: Prisma schema cannot express CHECK constraints or partial unique indexes.
ALTER TABLE "stores"
    ADD CONSTRAINT "stores_prep_minutes_check" CHECK ("prep_minutes" >= 0),
    ADD CONSTRAINT "stores_per_order_minutes_check" CHECK ("per_order_minutes" >= 0);

ALTER TABLE "products"
    ADD CONSTRAINT "products_base_price_cents_check" CHECK ("base_price_cents" >= 0);

ALTER TABLE "spec_groups"
    ADD CONSTRAINT "spec_groups_min_select_check" CHECK ("min_select" >= 0),
    ADD CONSTRAINT "spec_groups_max_select_check" CHECK ("max_select" >= "min_select");

ALTER TABLE "spec_options"
    ADD CONSTRAINT "spec_options_price_delta_cents_check" CHECK ("price_delta_cents" >= 0);

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_items_amount_cents_check" CHECK ("items_amount_cents" >= 0),
    ADD CONSTRAINT "orders_discount_cents_check" CHECK ("discount_cents" >= 0),
    ADD CONSTRAINT "orders_payable_cents_check" CHECK ("payable_cents" >= 0),
    ADD CONSTRAINT "orders_paid_cents_check" CHECK ("paid_cents" >= 0);

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_unit_price_cents_check" CHECK ("unit_price_cents" >= 0),
    ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0),
    ADD CONSTRAINT "order_items_total_cents_check" CHECK ("total_cents" >= 0);

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_cents_check" CHECK ("amount_cents" >= 0);

ALTER TABLE "refunds"
    ADD CONSTRAINT "refunds_amount_cents_check" CHECK ("amount_cents" >= 0);

ALTER TABLE "pickup_counters"
    ADD CONSTRAINT "pickup_counters_last_seq_check" CHECK ("last_seq" >= 0);

-- 同一门店、同一取餐日，已生成的取餐码唯一；未支付订单没有取餐码，不参与约束。
CREATE UNIQUE INDEX "orders_store_id_business_date_pickup_code_key"
    ON "orders" ("store_id", "business_date", "pickup_code")
    WHERE "pickup_code" IS NOT NULL;
