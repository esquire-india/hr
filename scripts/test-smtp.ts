import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

async function verifySmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 465);

  console.log("-----------------------------------------");
  console.log("Testing Zoho Mail / SMTP Configuration");
  console.log("-----------------------------------------");
  console.log(`Host: ${host || "(not set)"}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user || "(not set)"}`);
  console.log(`Password: ${pass ? "********" : "(not set)"}`);
  console.log("-----------------------------------------");

  if (!host || !user || !pass) {
    console.error(
      "Error: SMTP_HOST, SMTP_USER, and SMTP_PASS must all be set in .env.local before testing."
    );
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    console.log("Connecting to Zoho SMTP server...");
    await transport.verify();
    console.log("SUCCESS: Connection to Zoho Mail SMTP server verified successfully!");
    console.log("HR Studio is ready to send system emails, payslips, and notifications.");
  } catch (error) {
    console.error("FAILED to connect to Zoho Mail SMTP server:");
    console.error(error instanceof Error ? error.message : error);
    console.log("\nTips for Zoho Mail:");
    console.log("1. If using 2-Factor Authentication, use an App Password generated at:");
    console.log("   https://accounts.zoho.in/home#security/app_password (or .com / .eu)");
    console.log("2. For India accounts (.in), use SMTP_HOST=smtppro.zoho.in (or smtp.zoho.in).");
    console.log("3. For Global accounts (.com), use SMTP_HOST=smtppro.zoho.com (or smtp.zoho.com).");
    console.log("4. Ensure SMTP access is enabled in your Zoho Mail account settings.");
    process.exit(1);
  }
}

verifySmtp();
