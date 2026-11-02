import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = await bcrypt.hash("Admin123!", 12);

await prisma.role.upsert({ where: { rolename: "admin" }, update: {}, create: { rolename: "admin" } });
await prisma.role.upsert({ where: { rolename: "normal" }, update: {}, create: { rolename: "normal" } });
await prisma.membership.upsert({ where: { mname: "Normal" }, update: { score: 10 }, create: { mname: "Normal", score: 10 } });
await prisma.user.upsert({
  where: { username: "admin" },
  update: {},
  create: {
    username: "admin",
    fullname: "System Admin",
    password,
    role: { connect: { rolename: "admin" } },
    membership: { connect: { mname: "Normal" } }
  }
});
for (const product of [
  { pname: "X", price: 100, quantity: 20 },
  { pname: "Y", price: 200, quantity: 20 }
]) {
  const existing = await prisma.product.findFirst({ where: { pname: product.pname } });
  if (existing) await prisma.product.update({ where: { pid: existing.pid }, data: product });
  else await prisma.product.create({ data: product });
}
await prisma.$disconnect();
console.log("Seed completed. Login: admin / Admin123!");
