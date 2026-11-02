import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(config.PORT, () => console.log(`API listening on port ${config.PORT}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  });
}
