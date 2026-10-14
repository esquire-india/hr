import { useState } from "react";
import DocumentUpload from "../DocumentUpload";
import { Employee, EmployeeDocument } from "../../types";
import OnboardingForm from "../OnboardingForm";
import OnboardingDetails from "../OnboardingDetails";
import { emptyOnboarding, missingRequired, onboardingIssues } from "../../onboarding";

/** Employee-facing: first-login details form (gate) and read-only profile with edit. */
export default function MyProfileView({
  employee,
  gate = false,
  onSave,
  documents = [],
  onUpload,
}: {
  employee: Employee;
  gate?: boolean;
  onSave: (onboarding: any, version: number) => Promise<boolean>;
  documents?: EmployeeDocument[];
  onUpload?: (doc: any) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(gate);
  const draftKey = `hrstudio-onboarding-draft-${employee.id}`;
  const [draft, setDraft] = useState(() => {
    if (employee.onboarding) return employee.onboarding;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return { ...emptyOnboarding(), ...JSON.parse(saved) };
    } catch {}
    const [first = "", ...rest] = employee.name.trim().split(/\s+/);
    return {
      ...emptyOnboarding(),
      firstName: first,
      lastName: rest.pop() || "",
      middleName: rest.join(" "),
      personalEmail: "",
    };
  });
  const change = (next: typeof draft) => {
    setDraft(next);
    if (gate)
      try {
        localStorage.setItem(draftKey, JSON.stringify(next));
      } catch {}
  };
  const requiredTotal = 9;
  const done = requiredTotal - missingRequired(draft).length;
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = Object.values(onboardingIssues(draft))[0];
    const missing = missingRequired(draft);
    if (issue || missing.length)
      return setError(issue || `Please complete: ${missing.join(", ")}.`);
    setError("");
    if (await onSave(draft, employee.version)) {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setEditing(false);
    }
  }

  if (editing)
    return (
      <form onSubmit={submit} className="space-y-4 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">
            {gate ? `Welcome, ${employee.name}` : "Edit my details"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {gate
              ? "Please complete your details before continuing. Aadhaar, PAN, contact and emergency details are required."
              : "Changing your Aadhaar or PAN sends it back to HR for verification."}
          </p>
        </div>
        {gate && (
          <div aria-label="Progress" className="text-xs">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${(done / requiredTotal) * 100}%`, background: "linear-gradient(135deg,#003F8A,#0056B3)", transition: "width 0.3s" }}
              />
            </div>
            <p className="mt-1 text-slate-500">
              {done} of {requiredTotal} required items complete. Your progress is saved on this device.
            </p>
          </div>
        )}
        <OnboardingForm value={draft} onChange={change} hideVerification />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {!gate && (
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button className="account-primary">Save details</button>
        </div>
      </form>
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            {employee.role} · {employee.department}
          </p>
        </div>
        <button className="account-primary" onClick={() => { setDraft(employee.onboarding || emptyOnboarding()); setEditing(true); }}>
          Edit details
        </button>
      </div>
      <OnboardingDetails value={employee.onboarding} />
      {onUpload && (
        <DocumentUpload
          documents={documents.filter((d) => d.employeeId === employee.id)}
          categories={["ID Proof", "Certificate"]}
          onUpload={onUpload}
        />
      )}
    </div>
  );
}
