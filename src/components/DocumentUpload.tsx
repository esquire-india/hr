import React, { useState } from "react";
import { EmployeeDocument } from "../types";

function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

/** Lists an employee's files and adds new ones. Existing files are never edited here. */
export default function DocumentUpload({
  documents,
  categories,
  onUpload,
}: {
  documents: EmployeeDocument[];
  categories: string[];
  onUpload: (doc: { category: string; name: string; mimeType: string; contentBase64: string }) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file") as File;
    setMessage("");
    if (!file?.size || file.size > 2 * 1024 * 1024)
      return setMessage("Choose a file up to 2 MB.");
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
      return setMessage("Use PDF, PNG or JPEG.");
    setBusy(true);
    try {
      const saved = await onUpload({
        category: String(fields.get("category")),
        name: file.name,
        mimeType: file.type,
        contentBase64: await readBase64(file),
      });
      if (saved) {
        form.reset();
        setMessage("Document saved.");
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
        Documents
      </h4>
      <ul className="space-y-2 text-xs mb-4">
        {documents.map((d) => (
          <li key={d.id} className="flex justify-between gap-2">
            <a className="truncate underline" href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer">{d.name}</a>
            <span className="text-slate-500">{d.category} · {d.uploadDate}</span>
          </li>
        ))}
        {!documents.length && <li className="text-slate-500">No documents uploaded yet.</li>}
      </ul>
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <label className="text-xs space-y-1">
          Type
          <select name="category" className="account-input">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          File (PDF, PNG, JPEG, up to 2 MB)
          <input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg" className="account-input" />
        </label>
        <button className="account-primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
      <p className="text-[11px] text-slate-500 mt-2">
        Uploaded files cannot be changed afterwards. Ask HR if one needs replacing.
      </p>
      {message && <p role="status" className="text-xs mt-2">{message}</p>}
    </div>
  );
}
