import React from "react";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import {
  BANKS,
  BLOOD_GROUPS,
  GENDERS,
  MARITAL,
  VERIFY_STATES,
  isValidAadhaar,
  isValidPan,
  onboardingIssues,
  type OnboardingProfile,
  type VerifyState,
} from "../onboarding";

interface Props {
  value: OnboardingProfile;
  onChange: (next: OnboardingProfile) => void;
  hideVerification?: boolean;
}

const tone: Record<VerifyState, string> = {
  Pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Verified: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function OnboardingForm({ value, onChange, hideVerification }: Props) {
  const issues = onboardingIssues(value);
  const set = <K extends keyof OnboardingProfile>(
    key: K,
    v: OnboardingProfile[K],
  ) => onChange({ ...value, [key]: v });
  const setRow = <K extends "family" | "education" | "experience" | "projects">(
    key: K,
    index: number,
    patch: Partial<OnboardingProfile[K][number]>,
  ) =>
    set(
      key,
      value[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) as any,
    );
  const addRow = (key: "family" | "education" | "experience" | "projects", row: any) =>
    set(key, [...value[key], row] as any);
  const removeRow = (key: "family" | "education" | "experience" | "projects", i: number) =>
    set(key, value[key].filter((_, n) => n !== i) as any);

  const field = (label: string, input: React.ReactNode, error?: string) => (
    <label className="text-xs space-y-1 block">
      {label}
      {input}
      {error && <span className="block text-red-500">{error}</span>}
    </label>
  );
  const text = (
    key: keyof OnboardingProfile,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) =>
    field(
      label,
      <input
        className="account-input"
        value={value[key] as string}
        onChange={(e) => set(key, e.target.value as any)}
        {...extra}
      />,
      issues[key as string],
    );
  const select = (key: keyof OnboardingProfile, label: string, options: string[]) =>
    field(
      label,
      <select
        className="account-input"
        value={value[key] as string}
        onChange={(e) => set(key, e.target.value as any)}
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>,
    );

  const docRow = (
    kind: "pan" | "aadhaar",
    label: string,
    valid: boolean,
    inputProps: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div className="space-y-1">
      {field(
        label,
        <input
          className="account-input font-mono"
          value={value[kind]}
          onChange={(e) =>
            onChange({
              ...value,
              [kind]: kind === "pan" ? e.target.value.toUpperCase() : e.target.value,
              verification: { ...value.verification, [kind]: "Pending" },
            })
          }
          {...inputProps}
        />,
        issues[kind],
      )}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={valid ? "text-emerald-500" : "text-slate-400"}>
          {value[kind] ? (valid ? "Format valid" : "Format invalid") : "Not entered"}
        </span>
        {hideVerification ? (
          <span>{value.verification[kind]}</span>
        ) : (
        <select
          aria-label={`${label} verification status`}
          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${tone[value.verification[kind]]}`}
          value={value.verification[kind]}
          disabled={!valid}
          onChange={(e) =>
            set("verification", {
              ...value.verification,
              [kind]: e.target.value as VerifyState,
            })
          }
        >
          {VERIFY_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        )}
      </div>
    </div>
  );

  const section = (title: string, children: React.ReactNode, open = false) => (
    <details open={open} className="border border-slate-200 dark:border-slate-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold">{title}</summary>
      <div className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </details>
  );
  const addButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="sm:col-span-2 text-xs font-bold text-purple-500 flex items-center gap-1"
    >
      <Plus size={14} /> {label}
    </button>
  );
  const removeButton = (onClick: () => void) => (
    <button
      type="button"
      aria-label="Remove row"
      onClick={onClick}
      className="text-red-400 justify-self-end"
    >
      <Trash2 size={14} />
    </button>
  );
  const rowBox = (children: React.ReactNode) => (
    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
      {children}
    </div>
  );
  const cell = (
    placeholder: string,
    v: string,
    onChangeValue: (v: string) => void,
    type = "text",
  ) => (
    <input
      className="account-input"
      aria-label={placeholder}
      placeholder={placeholder}
      type={type}
      value={v}
      onChange={(e) => onChangeValue(e.target.value)}
    />
  );

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
      <h4 className="text-xs font-bold flex items-center gap-1.5">
        <BadgeCheck className="w-3.5 h-3.5 text-purple-400" />
        Onboarding profile &amp; document verification
      </h4>

      {section(
        "Identity documents",
        <>
          {docRow("aadhaar", "Aadhaar / UID", isValidAadhaar(value.aadhaar), {
            inputMode: "numeric",
            maxLength: 14,
            placeholder: "1234 5678 9012",
          })}
          {docRow("pan", "PAN No.", isValidPan(value.pan), {
            maxLength: 10,
            placeholder: "ABCDE1234F",
          })}
          {text("uan", "EPF UAN (if applicable)", { inputMode: "numeric", maxLength: 12 })}
        </>,
        true,
      )}

      {section(
        "Personal details",
        <>
          {text("firstName", "First name")}
          {text("middleName", "Middle name")}
          {text("lastName", "Last name")}
          {select("gender", "Gender", GENDERS)}
          {text("dob", "Date of birth", { type: "date" })}
          {text("personalEmail", "Personal email", { type: "email" })}
          {text("mobile", "Mobile no.", { inputMode: "tel" })}
          {select("maritalStatus", "Marital status", MARITAL)}
          {select("bloodGroup", "Blood group", BLOOD_GROUPS)}
        </>,
      )}

      {section(
        "Addresses",
        <>
          {text("currentAddress", "Current address")}
          {text("currentPin", "Pin / post / zip code", { maxLength: 6 })}
          <label className="sm:col-span-2 text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                !!value.currentAddress &&
                value.permanentAddress === value.currentAddress &&
                value.permanentPin === value.currentPin
              }
              onChange={(e) =>
                e.target.checked &&
                onChange({
                  ...value,
                  permanentAddress: value.currentAddress,
                  permanentPin: value.currentPin,
                })
              }
            />
            Permanent address is the same as current
          </label>
          {text("permanentAddress", "Permanent address")}
          {text("permanentPin", "Pin / post / zip code", { maxLength: 6 })}
        </>,
      )}

      {section(
        "Emergency contacts & bank",
        <>
          {value.emergency.map((c, i) => (
            <React.Fragment key={i}>
              {field(
                `Emergency contact ${i + 1} — name & relation`,
                <div className="grid grid-cols-2 gap-2">
                  {cell("Name", c.name, (v) =>
                    set(
                      "emergency",
                      value.emergency.map((x, n) => (n === i ? { ...x, name: v } : x)),
                    ),
                  )}
                  {cell("Relation", c.relation, (v) =>
                    set(
                      "emergency",
                      value.emergency.map((x, n) => (n === i ? { ...x, relation: v } : x)),
                    ),
                  )}
                </div>,
              )}
              {field(
                `Emergency no. ${i + 1}`,
                cell("Phone", c.phone, (v) =>
                  set(
                    "emergency",
                    value.emergency.map((x, n) => (n === i ? { ...x, phone: v } : x)),
                  ),
                ),
                issues[`emergency${i}`],
              )}
            </React.Fragment>
          ))}
          <div className="sm:col-span-2 text-xs space-y-1">
            Holds an account with (optional)
            <div className="flex flex-wrap gap-3">
              {BANKS.map((bank) => (
                <label key={bank} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={value.bankUsed.includes(bank)}
                    onChange={(e) =>
                      set(
                        "bankUsed",
                        e.target.checked
                          ? [...value.bankUsed, bank]
                          : value.bankUsed.filter((b) => b !== bank),
                      )
                    }
                  />
                  {bank}
                </label>
              ))}
            </div>
          </div>
        </>,
      )}

      {section(
        "Family members",
        <>
          {value.family.map((m, i) => (
            <React.Fragment key={i}>
              {rowBox(
                <>
                  {cell("Name", m.name, (v) => setRow("family", i, { name: v }))}
                  {cell("Relation", m.relation, (v) => setRow("family", i, { relation: v }))}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <select
                      className="account-input"
                      aria-label="Dependent status"
                      value={m.dependent ? "Dependent" : "Non-dependent"}
                      onChange={(e) =>
                        setRow("family", i, { dependent: e.target.value === "Dependent" })
                      }
                    >
                      <option>Dependent</option>
                      <option>Non-dependent</option>
                    </select>
                    {removeButton(() => removeRow("family", i))}
                  </div>
                </>,
              )}
            </React.Fragment>
          ))}
          {addButton("Add family member", () =>
            addRow("family", { name: "", relation: "", dependent: true }),
          )}
        </>,
      )}

      {section(
        "Education (latest first)",
        <>
          {value.education.map((q, i) =>
            rowBox(
              <React.Fragment key={i}>
                {cell("Degree / qualification", q.degree, (v) =>
                  setRow("education", i, { degree: v }),
                )}
                {cell("Institution", q.institution, (v) =>
                  setRow("education", i, { institution: v }),
                )}
                <div className="flex gap-2">
                  {cell("Year", q.year, (v) => setRow("education", i, { year: v }))}
                  {removeButton(() => removeRow("education", i))}
                </div>
              </React.Fragment>,
            ),
          )}
          {addButton("Add qualification", () =>
            addRow("education", { degree: "", institution: "", year: "" }),
          )}
        </>,
      )}

      {section(
        "Work & project experience",
        <>
          {value.experience.map((x, i) =>
            rowBox(
              <React.Fragment key={i}>
                {cell("Company", x.company, (v) => setRow("experience", i, { company: v }))}
                {cell("Role", x.role, (v) => setRow("experience", i, { role: v }))}
                <div className="flex gap-2">
                  {cell("From", x.from, (v) => setRow("experience", i, { from: v }), "date")}
                  {cell("To", x.to, (v) => setRow("experience", i, { to: v }), "date")}
                  {removeButton(() => removeRow("experience", i))}
                </div>
              </React.Fragment>,
            ),
          )}
          {addButton("Add work experience", () =>
            addRow("experience", { company: "", role: "", from: "", to: "" }),
          )}
          {value.projects.map((x, i) =>
            rowBox(
              <React.Fragment key={i}>
                {cell("Project", x.name, (v) => setRow("projects", i, { name: v }))}
                {cell("Role", x.role, (v) => setRow("projects", i, { role: v }))}
                <div className="flex gap-2">
                  {cell("Summary", x.summary, (v) => setRow("projects", i, { summary: v }))}
                  {removeButton(() => removeRow("projects", i))}
                </div>
              </React.Fragment>,
            ),
          )}
          {addButton("Add project", () =>
            addRow("projects", { name: "", role: "", summary: "" }),
          )}
        </>,
      )}

      {section(
        "Health",
        <div className="sm:col-span-2">
          {field(
            "Health conditions / medications (if any)",
            <textarea
              className="account-input"
              rows={3}
              value={value.health}
              onChange={(e) => set("health", e.target.value)}
            />,
          )}
        </div>,
      )}
    </div>
  );
}
