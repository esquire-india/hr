// Shared by the browser form and the server validator: pure functions only.

export const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
export const MARITAL = ["Single", "Married", "Divorced", "Widowed"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const BANKS = ["Axis Bank Ltd.", "IDBI Bank Ltd.", "ICICI Bank Ltd."];
export const VERIFY_STATES = ["Pending", "Verified", "Rejected"] as const;
export type VerifyState = (typeof VERIFY_STATES)[number];

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}
export interface FamilyMember {
  name: string;
  relation: string;
  dependent: boolean;
}
export interface Qualification {
  degree: string;
  institution: string;
  year: string;
}
export interface WorkExperience {
  company: string;
  role: string;
  from: string;
  to: string;
}
export interface ProjectExperience {
  name: string;
  role: string;
  summary: string;
}
export interface OnboardingProfile {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dob: string;
  personalEmail: string;
  currentAddress: string;
  currentPin: string;
  permanentAddress: string;
  permanentPin: string;
  mobile: string;
  emergency: EmergencyContact[];
  bloodGroup: string;
  bankUsed: string[];
  pan: string;
  aadhaar: string;
  uan: string;
  maritalStatus: string;
  family: FamilyMember[];
  education: Qualification[];
  experience: WorkExperience[];
  projects: ProjectExperience[];
  health: string;
  verification: { pan: VerifyState; aadhaar: VerifyState; panNote?: string; aadhaarNote?: string };
}

export function emptyOnboarding(): OnboardingProfile {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dob: "",
    personalEmail: "",
    currentAddress: "",
    currentPin: "",
    permanentAddress: "",
    permanentPin: "",
    mobile: "",
    emergency: [
      { name: "", relation: "", phone: "" },
      { name: "", relation: "", phone: "" },
    ],
    bloodGroup: "",
    bankUsed: [],
    pan: "",
    aadhaar: "",
    uan: "",
    maritalStatus: "",
    family: [],
    education: [],
    experience: [],
    projects: [],
    health: "",
    verification: { pan: "Pending", aadhaar: "Pending" },
  };
}

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export const digitsOnly = (v: string) => v.replace(/\D/g, "");

/** 12 digits, not starting 0 or 1, passing the Verhoeff checksum UIDAI uses. */
export function isValidAadhaar(value: string): boolean {
  const n = digitsOnly(value);
  if (!/^[2-9]\d{11}$/.test(n)) return false;
  let c = 0;
  [...n].reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]];
  });
  return c === 0;
}

/** AAAAA9999A; 4th letter is the holder type. */
export function isValidPan(value: string): boolean {
  return /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/.test(value.trim().toUpperCase());
}

export const isValidUan = (v: string) => /^\d{12}$/.test(digitsOnly(v));
export const isValidPin = (v: string) => /^[1-9]\d{5}$/.test(v.trim());
export const isValidMobile = (v: string) =>
  /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.trim().replace(/[\s-]/g, "").replace(/^(\+91)/, "+91"));

export const maskAadhaar = (v: string) =>
  digitsOnly(v).length === 12 ? `XXXX XXXX ${digitsOnly(v).slice(8)}` : "";

/** Field-level problems; empty object means the profile is acceptable. */
export function onboardingIssues(p: OnboardingProfile): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.pan && !isValidPan(p.pan)) e.pan = "PAN must look like ABCDE1234F.";
  if (p.aadhaar && !isValidAadhaar(p.aadhaar))
    e.aadhaar = "Enter a valid 12-digit Aadhaar number.";
  if (p.uan && !isValidUan(p.uan)) e.uan = "UAN is 12 digits.";
  if (p.currentPin && !isValidPin(p.currentPin)) e.currentPin = "Enter a 6-digit PIN.";
  if (p.permanentPin && !isValidPin(p.permanentPin))
    e.permanentPin = "Enter a 6-digit PIN.";
  if (p.mobile && !isValidMobile(p.mobile)) e.mobile = "Enter a 10-digit mobile number.";
  if (p.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.personalEmail))
    e.personalEmail = "Enter a valid email address.";
  if (p.dob && p.dob >= new Date().toISOString().slice(0, 10))
    e.dob = "Date of birth must be in the past.";
  p.emergency.forEach((c, i) => {
    if (c.phone && !isValidMobile(c.phone))
      e[`emergency${i}`] = "Enter a valid emergency number.";
  });
  if (p.verification.pan === "Rejected" && !p.verification.panNote?.trim())
    e.pan = "Give a reason when rejecting the PAN.";
  if (p.verification.aadhaar === "Rejected" && !p.verification.aadhaarNote?.trim())
    e.aadhaar = "Give a reason when rejecting the Aadhaar.";
  if (p.verification.pan === "Verified" && !isValidPan(p.pan))
    e.pan = "Cannot mark PAN verified without a valid PAN.";
  if (p.verification.aadhaar === "Verified" && !isValidAadhaar(p.aadhaar))
    e.aadhaar = "Cannot mark Aadhaar verified without a valid number.";
  return e;
}

/** What an employee must supply on first login. */
export function missingRequired(p: OnboardingProfile): string[] {
  const m: string[] = [];
  if (!p.firstName.trim()) m.push("First name");
  if (!p.lastName.trim()) m.push("Last name");
  if (!p.gender) m.push("Gender");
  if (!p.dob) m.push("Date of birth");
  if (!isValidMobile(p.mobile)) m.push("Mobile no.");
  if (!p.currentAddress.trim() || !isValidPin(p.currentPin))
    m.push("Current address with PIN");
  if (!p.emergency[0]?.name.trim() || !isValidMobile(p.emergency[0]?.phone || ""))
    m.push("Emergency contact 1");
  if (!isValidAadhaar(p.aadhaar)) m.push("Aadhaar");
  if (!isValidPan(p.pan)) m.push("PAN");
  return m;
}

export function onboardingRows(ob: OnboardingProfile): [string, string][] {
  return [
    ["Legal name", [ob.firstName, ob.middleName, ob.lastName].filter(Boolean).join(" ")],
    ["Gender", ob.gender],
    ["Date of birth", ob.dob],
    ["Personal email", ob.personalEmail],
    ["Mobile", ob.mobile],
    ["Marital status", ob.maritalStatus],
    ["Blood group", ob.bloodGroup],
    ["EPF UAN", ob.uan],
    ["Current address", [ob.currentAddress, ob.currentPin].filter(Boolean).join(" - ")],
    ["Permanent address", [ob.permanentAddress, ob.permanentPin].filter(Boolean).join(" - ")],
    ["Emergency contacts", ob.emergency.filter((c) => c.name || c.phone).map((c) => `${c.name} (${c.relation}) ${c.phone}`).join("; ")],
    ["Banks", ob.bankUsed.join(", ")],
    ["Family", ob.family.map((f) => `${f.name} (${f.relation}, ${f.dependent ? "dependent" : "non-dependent"})`).join("; ")],
    ["Education", ob.education.map((q) => `${q.degree}, ${q.institution} ${q.year}`).join("; ")],
    ["Experience", ob.experience.map((x) => `${x.role} at ${x.company}`).join("; ")],
    ["Projects", ob.projects.map((x) => x.name).join("; ")],
    ["Health", ob.health],
  ];
}

/** Waiting on HR: a well-formed number was submitted and has not been decided yet. */
export function awaitingVerification(p?: OnboardingProfile): ("PAN" | "Aadhaar")[] {
  if (!p) return [];
  const out: ("PAN" | "Aadhaar")[] = [];
  if (isValidPan(p.pan) && p.verification.pan === "Pending") out.push("PAN");
  if (isValidAadhaar(p.aadhaar) && p.verification.aadhaar === "Pending") out.push("Aadhaar");
  return out;
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
/** CSV that opens directly in Excel. Aadhaar is masked. */
export function onboardingCsv(
  people: { name: string; id: string; onboarding?: OnboardingProfile }[],
): string {
  const labels = onboardingRows(emptyOnboarding()).map(([k]) => k);
  const head = ["Employee", "ID", "Aadhaar (masked)", "Aadhaar status", "PAN", "PAN status", ...labels];
  const lines = people.map((e) => {
    const ob = e.onboarding || emptyOnboarding();
    return [
      e.name, e.id, maskAadhaar(ob.aadhaar), ob.verification.aadhaar, ob.pan, ob.verification.pan,
      ...onboardingRows(ob).map(([, v]) => v),
    ].map(csvCell).join(",");
  });
  return "\ufeff" + [head.map(csvCell).join(","), ...lines].join("\r\n");
}
