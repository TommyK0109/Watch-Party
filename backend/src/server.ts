import "dotenv/config";
import { createServer } from "node:http";
import app, { allowedOrigins } from "./app";
import { verifyEmailTransport } from "./services/email.service";
import { createSocketServer } from "./lib/socket";
import { deleteExpiredInvitations } from "./services/watchPartyInvitation.service";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await verifyEmailTransport();
    console.log("Email delivery connection verified");

    const httpServer = createServer(app);
    createSocketServer(httpServer, allowedOrigins);
    setInterval(() => {
      void deleteExpiredInvitations().catch((error) => console.error("Could not remove expired invitations", error));
    }, 15_000).unref();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error(`Server did not start: ${message}`);
    process.exitCode = 1;
  }
}

void startServer();
