import assert from "node:assert/strict";
import test from "node:test";
import {
  awaitingVerification,
  emptyOnboarding,
  isValidAadhaar,
  isValidMobile,
  isValidPan,
  maskAadhaar,
  missingRequired,
  onboardingCsv,
  onboardingIssues,
} from "../src/onboarding";

test("Aadhaar uses the Verhoeff checksum", () => {
  assert.ok(isValidAadhaar("234567890124"));
  assert.ok(isValidAadhaar("2345 6789 0124"));
  assert.ok(!isValidAadhaar("234567890123")); // bad check digit
  assert.ok(!isValidAadhaar("123456789012")); // cannot start with 1
  assert.ok(!isValidAadhaar("12345"));
  assert.equal(maskAadhaar("234567890124"), "XXXX XXXX 0124");
});

test("PAN, mobile and PIN formats", () => {
  assert.ok(isValidPan("abcpe1234f"));
  assert.ok(!isValidPan("ABCXE1234F")); // 4th letter must be a holder type
  assert.ok(isValidMobile("+91 98765 43210"));
  assert.ok(!isValidMobile("12345"));
  const p = { ...emptyOnboarding(), currentPin: "012345", uan: "123" };
  assert.deepEqual(Object.keys(onboardingIssues(p)).sort(), ["currentPin", "uan"]);
});

test("verification rules", () => {
  const p = emptyOnboarding();
  p.verification.pan = "Verified";
  assert.ok(onboardingIssues(p).pan);
  p.pan = "ABCPE1234F";
  assert.equal(onboardingIssues(p).pan, undefined);
  p.verification.pan = "Rejected";
  assert.ok(onboardingIssues(p).pan); // reason required
  p.verification.panNote = "Image unreadable";
  assert.equal(onboardingIssues(p).pan, undefined);
  p.verification.pan = "Pending";
  assert.deepEqual(awaitingVerification(p), ["PAN"]);
});

test("required fields and export", () => {
  assert.ok(missingRequired(emptyOnboarding()).length >= 8);
  const csv = onboardingCsv([{ name: 'A "B"', id: "1", onboarding: undefined }]);
  assert.match(csv, /"A ""B"""/);
});
