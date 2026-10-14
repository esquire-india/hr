import { HttpError, Store, type Actor, type Kind } from "./store";
import {
  approvalFor,
  decision,
  employeeExtras,
  leaveDetails,
} from "./suite-domain";
import {
  BANKS,
  VERIFY_STATES,
  digitsOnly,
  onboardingIssues,
  type OnboardingProfile,
  type VerifyState,
} from "../src/onboarding";
export function text(
  value: unknown,
  label: string,
  max = 200,
  optional = false,
): string {
  if (optional && (value === undefined || value === null || value === ""))
    return "";
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(
      400,
      `${label} is required and must be at most ${max} characters.`,
    );
  return value.trim();
}
export function email(value: unknown) {
  const result = text(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new HttpError(400, "Enter a valid email address.");
  return result;
}
export function choice(
  value: unknown,
  label: string,
  values: readonly string[],
): string {
  if (typeof value !== "string" || !values.includes(value))
    throw new HttpError(400, `Choose a valid ${label}.`);
  return value;
}
export function date(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new HttpError(400, `${label} must be a valid date.`);
  return value;
}
export function number(value: unknown, label: string, max = 100000000): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    throw new HttpError(400, `${label} must be between 0 and ${max}.`);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function password(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new HttpError(400, "Use a password with 12 to 128 characters.");
  return value;
}
export function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 50)
    throw new HttpError(400, `${label} needs 1 to 50 entries.`);
  const values = value.map((v) => text(v, label, 80));
  if (new Set(values.map((v) => v.toLowerCase())).size !== values.length)
    throw new HttpError(400, `${label} contains duplicates.`);
  return values;
}
export function companySettings(body: any) {
  const timezone = text(body.timezone, "Timezone", 80);
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new HttpError(400, "Choose a valid timezone.");
  }
  return {
    name: text(body.name, "Company name", 120),
    timezone,
    departments: stringList(body.departments, "Departments"),
    leaveTypes: stringList(body.leaveTypes, "Leave types"),
    currency: "INR",
  };
}
/** Rebuilds the onboarding profile from known fields only, then applies format checks. */
export function cleanOnboarding(raw: any): OnboardingProfile {
  const s = (v: unknown, max = 200) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const list = (v: unknown, n = 20): any[] => (Array.isArray(v) ? v.slice(0, n) : []);
  const state = (v: unknown): VerifyState =>
    VERIFY_STATES.includes(v as VerifyState) ? (v as VerifyState) : "Pending";
  const profile: OnboardingProfile = {
    firstName: s(raw.firstName, 80),
    middleName: s(raw.middleName, 80),
    lastName: s(raw.lastName, 80),
    gender: s(raw.gender, 40),
    dob: s(raw.dob, 10),
    personalEmail: s(raw.personalEmail, 254).toLowerCase(),
    currentAddress: s(raw.currentAddress, 500),
    currentPin: s(raw.currentPin, 6),
    permanentAddress: s(raw.permanentAddress, 500),
    permanentPin: s(raw.permanentPin, 6),
    mobile: s(raw.mobile, 20),
    emergency: list(raw.emergency, 2).map((c) => ({
      name: s(c?.name, 120),
      relation: s(c?.relation, 60),
      phone: s(c?.phone, 20),
    })),
    bloodGroup: s(raw.bloodGroup, 5),
    bankUsed: list(raw.bankUsed, 3).filter((b) => BANKS.includes(b)),
    pan: s(raw.pan, 10).toUpperCase(),
    aadhaar: digitsOnly(s(raw.aadhaar, 20)),
    uan: digitsOnly(s(raw.uan, 20)),
    maritalStatus: s(raw.maritalStatus, 40),
    family: list(raw.family).map((f) => ({
      name: s(f?.name, 120),
      relation: s(f?.relation, 60),
      dependent: f?.dependent === true,
    })),
    education: list(raw.education).map((q) => ({
      degree: s(q?.degree, 120),
      institution: s(q?.institution, 160),
      year: s(q?.year, 4),
    })),
    experience: list(raw.experience).map((x) => ({
      company: s(x?.company, 160),
      role: s(x?.role, 120),
      from: s(x?.from, 10),
      to: s(x?.to, 10),
    })),
    projects: list(raw.projects).map((x) => ({
      name: s(x?.name, 160),
      role: s(x?.role, 120),
      summary: s(x?.summary, 1000),
    })),
    health: s(raw.health, 1000),
    verification: {
      pan: state(raw.verification?.pan),
      aadhaar: state(raw.verification?.aadhaar),
      panNote: s(raw.verification?.panNote, 300),
      aadhaarNote: s(raw.verification?.aadhaarNote, 300),
    },
  };
  while (profile.emergency.length < 2)
    profile.emergency.push({ name: "", relation: "", phone: "" });
  const issue = Object.values(onboardingIssues(profile))[0];
  if (issue) throw new HttpError(400, issue);
  return profile;
}
/** Allowlisted input only: identities, durations, dates and status transitions are server-owned. */
export async function validateRecord(
  store: Store,
  actor: Actor,
  kind: Kind,
  body: any,
  existing?: any,
): Promise<any> {
  const company = await store.company(actor.orgId);
  const employee = async (id: unknown) =>
    await store.get(actor.orgId, "employees", text(id, "Employee"));
  switch (kind) {
    case "employees": {
      const salary = body.salary || {};
      const amounts = Object.fromEntries(
        ["basic", "hra", "allowances", "deductions"].map((k) => [
          k,
          number(salary[k], k),
        ]),
      );
      if (amounts.deductions > amounts.basic + amounts.hra + amounts.allowances)
        throw new HttpError(400, "Deductions cannot exceed gross salary.");
      const avatar = text(body.avatar, "Profile image URL", 1500, true);
      if (avatar && !/^https?:\/\//i.test(avatar))
        throw new HttpError(
          400,
          "Profile image must use an HTTP or HTTPS URL.",
        );
      const onboarding = body.onboarding
        ? cleanOnboarding(body.onboarding)
        : existing?.onboarding;
      if (onboarding && existing) {
        const newlyVerified = (["pan", "aadhaar"] as const).some(
          (k) =>
            onboarding.verification[k] === "Verified" &&
            existing.onboarding?.verification?.[k] !== "Verified",
        );
        if (
          newlyVerified &&
          !(await store.list(actor.orgId, "documents")).some(
            (d: any) => d.employeeId === existing.id && d.category === "ID Proof",
          )
        )
          throw new HttpError(
            400,
            "Upload and review an ID Proof document before marking Aadhaar or PAN as verified.",
          );
      }
      return {
        ...(await employeeExtras(store, actor, body, existing)),
        onboarding,
        name: text(body.name, "Name"),
        email: email(body.email),
        role: text(body.role, "Designation"),
        department: choice(body.department, "department", company.departments),
        contact: text(body.contact, "Contact", 80),
        hireDate: date(body.hireDate, "Hire date"),
        avatar,
        salary: amounts,
        status: choice(body.status || "Active", "status", [
          "Active",
          "On Leave",
          "Suspended",
          "Terminated",
        ]),
      };
    }
    case "leaves": {
      if (existing) {
        if (existing.status !== "Pending")
          throw new HttpError(409, "This request has already been decided.");
        if (existing.employeeId === actor.employeeId)
          throw new HttpError(
            403,
            "Another HR administrator must decide your own leave.",
          );
        const updated = decision(actor, existing, body.status, body.comment);
        if (updated.status === "Approved")
          Object.assign(
            updated,
            await leaveDetails(
              store,
              actor,
              await employee(existing.employeeId),
              existing.leaveType,
              existing.startDate,
              existing.endDate,
              existing.id,
            ),
          );
        return updated;
      }
      const emp = await employee(
        actor.accessRole === "employee" ? actor.employeeId : body.employeeId,
      );
      if (emp.status !== "Active")
        throw new HttpError(
          400,
          "Leave can only be requested for active employees.",
        );
      const start = date(body.startDate, "Start date"),
        end = date(body.endDate, "End date");
      if (end < start)
        throw new HttpError(400, "End date must be on or after start date.");
      const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
      if (days > 366)
        throw new HttpError(400, "Leave requests cannot exceed 366 days.");
      if (
        (await store.list(actor.orgId, "leaves")).some(
          (l) =>
            l.employeeId === emp.id &&
            ["Pending", "Approved"].includes(l.status) &&
            l.startDate <= end &&
            l.endDate >= start,
        )
      )
        throw new HttpError(
          409,
          "This employee already has leave covering those dates.",
        );
      const leaveType = choice(
        body.leaveType,
        "leave type",
        company.leaveTypes,
      );
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        startDate: start,
        endDate: end,
        ...(await leaveDetails(store, actor, emp, leaveType, start, end)),
        ...(await approvalFor(store, actor, "leaves", emp)),
        reason: text(body.reason, "Reason", 2000),
        leaveType,
        status: "Pending",
      };
    }
    case "jobs":
      return {
        title: text(body.title, "Job title"),
        department: choice(body.department, "department", company.departments),
        location: text(body.location, "Location"),
        type: choice(body.type, "job type", [
          "Full-time",
          "Part-time",
          "Contract",
          "Remote",
        ]),
        status: choice(body.status || "Active", "status", ["Active", "Closed"]),
        applicantsCount: 0,
      };
    case "candidates": {
      if (existing)
        return {
          ...existing,
          stage: choice(body.stage, "stage", [
            "Applied",
            "Interview",
            "Offered",
            "Rejected",
          ]),
        };
      const job = await store.get(actor.orgId, "jobs", text(body.jobId, "Job"));
      if (job.status !== "Active")
        throw new HttpError(400, "This job is closed.");
      return {
        name: text(body.name, "Name"),
        email: email(body.email),
        phone: text(body.phone, "Phone", 80, true),
        jobId: job.id,
        jobTitle: job.title,
        stage: "Applied",
        resumeText: text(body.resumeText, "Resume", 20000, true),
        appliedDate: new Date().toISOString().slice(0, 10),
      };
    }
    case "assets": {
      const status = choice(body.status, "status", [
        "Assigned",
        "Available",
        "Maintenance",
      ]);
      const emp =
        status === "Assigned" ? await employee(body.assignedToId) : null;
      return {
        name: text(body.name, "Asset name"),
        serialNumber: text(body.serialNumber, "Serial number"),
        category: choice(body.category, "category", [
          "Laptop",
          "Monitor",
          "Mobile",
          "Other",
        ]),
        status,
        assignedToId: emp?.id,
        assignedToName: emp?.name,
        purchaseDate: date(body.purchaseDate, "Purchase date"),
      };
    }
    case "appraisals": {
      if (existing)
        return {
          ...existing,
          status: choice(body.status, "status", ["Approved"]),
        };
      const emp = await employee(body.employeeId),
        selfRating = number(body.selfRating, "Self rating", 5),
        managerRating = number(body.managerRating, "Manager rating", 5);
      if (selfRating < 1 || managerRating < 1)
        throw new HttpError(400, "Ratings must be between 1 and 5.");
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        reviewerName: actor.name,
        period: text(body.period, "Review period", 80),
        goalsSet: text(body.goalsSet, "Goals", 5000),
        feedback: text(body.feedback, "Feedback", 5000),
        selfRating,
        managerRating,
        status: "Submitted",
        date: new Date().toISOString().slice(0, 10),
      };
    }
    default:
      throw new HttpError(405, "This record uses a dedicated workflow.");
  }
}
