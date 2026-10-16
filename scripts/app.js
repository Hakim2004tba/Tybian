/**
 * Passenger startup file for cPanel's "Setup Node.js App".
 *
 * cPanel asks for an "Application startup file" and Passenger loads it
 * instead of running `node server.js` itself, so this is a thin handoff
 * to the server Next emitted into .next/standalone/ (copied to the app
 * root by scripts/build-deploy.sh).
 *
 * Passenger intercepts .listen() and supplies its own socket, so the
 * PORT below is only a fallback for running this bundle directly
 * (`node app.js`) when testing the built output outside cPanel.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

require("./server.js");
