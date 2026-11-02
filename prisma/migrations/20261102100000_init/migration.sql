-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "roles" (
    "roleid" SERIAL NOT NULL,
    "rolename" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("roleid")
);

-- CreateTable
CREATE TABLE "memberships" (
    "mid" SERIAL NOT NULL,
    "mname" VARCHAR(50) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("mid")
);

-- CreateTable
CREATE TABLE "users" (
    "uid" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "fullname" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "roleid" INTEGER NOT NULL,
    "mid" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "products" (
    "pid" SERIAL NOT NULL,
    "pname" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("pid")
);

-- CreateTable
CREATE TABLE "orders" (
    "oid" SERIAL NOT NULL,
    "uid" INTEGER NOT NULL,
    "createat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "order_details" (
    "oid" INTEGER NOT NULL,
    "pid" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_details_pkey" PRIMARY KEY ("oid","pid")
);

-- CreateTable
CREATE TABLE "shipments" (
    "shipid" SERIAL NOT NULL,
    "oid" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("shipid")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_rolename_key" ON "roles"("rolename");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_mname_key" ON "memberships"("mname");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_roleid_idx" ON "users"("roleid");

-- CreateIndex
CREATE INDEX "users_mid_idx" ON "users"("mid");

-- CreateIndex
CREATE INDEX "orders_uid_idx" ON "orders"("uid");

-- CreateIndex
CREATE INDEX "shipments_oid_idx" ON "shipments"("oid");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleid_fkey" FOREIGN KEY ("roleid") REFERENCES "roles"("roleid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_mid_fkey" FOREIGN KEY ("mid") REFERENCES "memberships"("mid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_uid_fkey" FOREIGN KEY ("uid") REFERENCES "users"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_oid_fkey" FOREIGN KEY ("oid") REFERENCES "orders"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_pid_fkey" FOREIGN KEY ("pid") REFERENCES "products"("pid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_oid_fkey" FOREIGN KEY ("oid") REFERENCES "orders"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

