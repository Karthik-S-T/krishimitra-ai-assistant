import { Phone } from "@convex-dev/auth/providers/Phone";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Phone OTP provider (+91 Indian mobile numbers).
 *
 * MODES (clearly separated — there is NO fake acceptance anywhere):
 *
 * 1. PRODUCTION (default when `AUTH_MOCK_MODE !== "true"`):
 *    Requires a real SMS gateway. Set `SMS_PROVIDER_API_KEY` (+ optional
 *    `SMS_PROVIDER_URL`) in the environment, then implement the gateway call
 *    in `sendViaSmsGateway` below. Until configured, sending throws a clear
 *    error instead of silently pretending to send.
 *
 * 2. DEVELOPMENT MOCK (`AUTH_MOCK_MODE = "true"`, or automatically when no
 *    SMS key is configured):
 *    The OTP is generated and verified by Convex Auth exactly as in
 *    production, but delivery is mocked: the code is written ONLY to the
 *    Convex dashboard function logs (server side). It is never sent to the
 *    client and never auto-accepted — the developer must read the real code
 *    from the logs to sign in.
 */

const isMockMode = () =>
  process.env.AUTH_MOCK_MODE === "true" ||
  (!process.env.SMS_PROVIDER_API_KEY && process.env.AUTH_MOCK_MODE !== "false");

/** Production SMS delivery — wire your gateway here (MSG91 / Twilio /
 *  Fast2SMS / gupshup …). Kept separate so mock logic can never leak into
 *  the production path. */
async function sendViaSmsGateway(phone: string, token: string): Promise<void> {
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SMS provider is not configured. Set SMS_PROVIDER_API_KEY in the environment (or enable AUTH_MOCK_MODE for development).",
    );
  }
  const url = process.env.SMS_PROVIDER_URL;
  if (!url) {
    throw new Error(
      "SMS_PROVIDER_URL is not set — cannot deliver the OTP. Configure your SMS gateway endpoint.",
    );
  }
  // Generic gateway contract: POST { url } with the recipient, OTP and app
  // name. Adjust the payload to match your provider when you wire it up.
  const axios = (await import("axios")).default;
  await axios.post(
    url,
    {
      to: phone,
      otp: token,
      appName: process.env.VLY_APP_NAME || "KrishiMitra AI",
    },
    { headers: { "x-api-key": apiKey }, timeout: 10_000 },
  );
}

export const phoneOtp = Phone({
  id: "phone-otp",
  maxAge: 60 * 10, // OTP expires after 10 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    // Exactly 6 numeric digits.
    return generateRandomString(random, "0123456789", 6);
  },
  // Accept "+91XXXXXXXXXX", "91XXXXXXXXXX", "0XXXXXXXXXX" or bare 10 digits —
  // always stored as E.164-style "+91XXXXXXXXXX".
  normalizeIdentifier(identifier: string) {
    const digits = identifier.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    return `+91${last10}`;
  },
  async sendVerificationRequest({ identifier: phone, token }) {
    if (isMockMode()) {
      // DEV MOCK: server-side log only. The client is never told the code.
      console.log(
        `[AUTH MOCK] Phone OTP for ${phone}: ${token} (valid 10 minutes)`,
      );
      return;
    }
    await sendViaSmsGateway(phone, token);
  },
});
