import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authenticate, requireRole, validate } from "./middleware.js";

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan("combined"));

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() });
});

const registerSchema = z.object({ username: z.string().min(3).max(50), fullname: z.string().min(1).max(100), password: z.string().min(8) });
app.post("/api/auth/register", validate(registerSchema), async (req, res) => {
  const normal = await prisma.role.findUniqueOrThrow({ where: { rolename: "normal" } });
  const membership = await prisma.membership.findUniqueOrThrow({ where: { mname: "Normal" } });
  const user = await prisma.user.create({
    data: { ...req.body, password: await bcrypt.hash(req.body.password, 12), roleid: normal.roleid, mid: membership.mid },
    include: { role: true, membership: true },
  });
  res.status(201).json({
    uid: user.uid,
    username: user.username,
    fullname: user.fullname,
    role: user.role.rolename,
    membership: user.membership.mname,
    score: user.membership.score
  });
});

app.post("/api/auth/login", validate(z.object({ username: z.string(), password: z.string() })), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: req.body.username }, include: { role: true } });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ sub: user.uid, username: user.username, role: user.role.rolename }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
  res.json({ token, user: { uid: user.uid, username: user.username, fullname: user.fullname, role: user.role.rolename } });
});

const productSchema = z.object({ pname: z.string().min(1).max(100), price: z.coerce.number().nonnegative(), quantity: z.coerce.number().int().nonnegative() });
app.get("/api/products", async (_req, res) => res.json(await prisma.product.findMany({ orderBy: { pid: "desc" } })));
app.get("/api/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { pid: Number(req.params.id) } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});
app.post("/api/products", authenticate, requireRole("admin"), validate(productSchema), async (req, res) => res.status(201).json(await prisma.product.create({ data: req.body })));
app.patch("/api/products/:id", authenticate, requireRole("admin"), validate(productSchema.partial()), async (req, res) => res.json(await prisma.product.update({ where: { pid: Number(req.params.id) }, data: req.body })));
app.delete("/api/products/:id", authenticate, requireRole("admin"), async (req, res) => { await prisma.product.delete({ where: { pid: Number(req.params.id) } }); res.status(204).send(); });

const orderSchema = z.object({ items: z.array(z.object({ pid: z.coerce.number().int().positive(), qty: z.coerce.number().int().positive() })).min(1) });
app.post("/api/orders", authenticate, validate(orderSchema), async (req, res) => {
  const ids = req.body.items.map((item) => item.pid);
  const products = await prisma.product.findMany({ where: { pid: { in: ids } } });
  const byId = new Map(products.map((p) => [p.pid, p]));
  for (const item of req.body.items) {
    const product = byId.get(item.pid);
    if (!product) return res.status(400).json({ error: `Product ${item.pid} not found` });
    if (product.quantity < item.qty) return res.status(400).json({ error: `Insufficient stock for product ${item.pid}` });
  }
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({ data: { uid: req.user.sub, details: { create: req.body.items.map((item) => ({ pid: item.pid, qty: item.qty, unitPrice: byId.get(item.pid).price })) }, shipments: { create: { status: "pending" } } }, include: { details: { include: { product: true } }, shipments: true } });
    for (const item of req.body.items) await tx.product.update({ where: { pid: item.pid }, data: { quantity: { decrement: item.qty } } });
    return created;
  });
  res.status(201).json(order);
});
app.get("/api/orders", authenticate, async (req, res) => {
  const where = req.user.role === "admin" ? {} : { uid: req.user.sub };
  res.json(await prisma.order.findMany({ where, include: { details: { include: { product: true } }, shipments: true }, orderBy: { createat: "desc" } }));
});
app.get("/api/orders/:id", authenticate, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { oid: Number(req.params.id), ...(req.user.role === "admin" ? {} : { uid: req.user.sub }) },
    include: { details: { include: { product: true } }, shipments: true }
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});
app.get("/api/shipments/:id", authenticate, async (req, res) => {
  const shipment = await prisma.shipment.findFirst({
    where: { shipid: Number(req.params.id), ...(req.user.role === "admin" ? {} : { order: { uid: req.user.sub } }) }
  });
  if (!shipment) return res.status(404).json({ error: "Shipment not found" });
  res.json(shipment);
});
app.patch("/api/shipments/:id", authenticate, requireRole("admin"), validate(z.object({ status: z.string().min(1).max(50) })), async (req, res) => res.json(await prisma.shipment.update({ where: { shipid: Number(req.params.id) }, data: { status: req.body.status } })));

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "P2002") return res.status(409).json({ error: "Unique constraint violation" });
  if (err.code === "P2025") return res.status(404).json({ error: "Resource not found" });
  res.status(500).json({ error: "Internal server error" });
});
