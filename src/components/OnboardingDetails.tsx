import { emptyOnboarding, maskAadhaar, onboardingRows, type OnboardingProfile, type VerifyState } from "../onboarding";

export default function OnboardingDetails({
  value,
  onDecide,
}: {
  value?: OnboardingProfile;
  /** HR only: approve or reject a document. Omitted for the employee's own read-only view. */
  onDecide?: (kind: "pan" | "aadhaar", state: VerifyState, note: string) => void;
}) {
  const ob = value || emptyOnboarding();
  const decide = (kind: "pan" | "aadhaar", state: VerifyState) => {
    let note = "";
    if (state === "Rejected") {
      note = (window.prompt("Reason for rejecting (the employee will see this):") || "").trim();
      if (!note) return;
    }
    onDecide?.(kind, state, note);
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
        Identity verification &amp; onboarding profile
      </h4>
      <div className="space-y-3 text-xs mb-4">
        {([
          ["Aadhaar", "aadhaar", maskAadhaar(ob.aadhaar), ob.verification.aadhaar, ob.verification.aadhaarNote],
          ["PAN", "pan", ob.pan, ob.verification.pan, ob.verification.panNote],
        ] as const).map(([label, kind, val, state, note]) => (
          <div key={label}>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300">
                {label}: <span className="font-mono">{val || "Not provided"}</span>
              </span>
              <span className="flex items-center gap-2">
                <strong>{state}</strong>
                {onDecide && val && (
                  <>
                    <button type="button" className="text-action" onClick={() => decide(kind, "Verified")}>Approve</button>
                    <button type="button" className="text-action" onClick={() => decide(kind, "Rejected")}>Reject</button>
                  </>
                )}
              </span>
            </div>
            {state === "Rejected" && note && (
              <p className="text-red-500 mt-1">Reason: {note}. Please update this in Edit details.</p>
            )}
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {onboardingRows(ob).map(([label, val]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase text-slate-500 font-semibold">{label}</dt>
            <dd className="text-slate-700 dark:text-slate-300">{val || "—"}</dd>
          </div>
        ))}
      </dl>
      {!value && (
        <p className="text-xs text-slate-500 mt-4">
          No onboarding details yet. Use Edit Profile to add them and verify Aadhaar and PAN.
        </p>
      )}
    </div>
  );
}
