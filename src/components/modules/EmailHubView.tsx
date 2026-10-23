import React, { useState } from 'react';
import { Employee, EmailLog, CompanySettings } from '../../types';
import { ErrorMessage, Field } from '../AccountViews';

interface EmailHubViewProps {
  employees: Employee[];
  emailLogs: EmailLog[];
  mailConfigured: boolean;
  company?: CompanySettings;
  onSend: (data: any) => Promise<boolean>;
  onSendMass?: (data: any) => Promise<boolean>;
  onGenerateEmail?: (topic: string, tone: string) => Promise<{ subject: string; body: string; campaignType: string }>;
}

export default function EmailHubView({
  employees,
  emailLogs,
  mailConfigured,
  company,
  onSend,
  onSendMass,
  onGenerateEmail,
}: EmailHubViewProps) {
  // Modes: "single" or "mass"
  const [sendMode, setSendMode] = useState<'single' | 'mass'>('single');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Email form fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignType, setCampaignType] = useState<EmailLog['campaignType']>('General Notice');

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState('Warm and Festive');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  // Status and messages
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Employee details for single mode
  const employee = employees.find(emp => emp.id === employeeId);
  const manager = employees.find(e => e.id === employee?.managerId);
  const director = employees.find(e => {
    const t = (e.title || (e as any).role || '').toLowerCase();
    return t.includes('director') || t.includes('managing director') || t.includes('md');
  });
  const accounts = employees.find(e => {
    const d = (e.department || '').toLowerCase();
    const t = (e.title || (e as any).role || '').toLowerCase();
    return d === 'accounts' || d === 'finance' || t.includes('account');
  });

  const previewCcEmails = Array.from(
    new Set(
      [manager?.email, director?.email, accounts?.email].filter(
        (e): e is string => Boolean(e) && e.toLowerCase() !== employee?.email?.toLowerCase()
      )
    )
  );

  // Audience calculation for mass mode
  const activeEmployees = employees.filter(e => {
    if (e.status && e.status !== 'Active') return false;
    if (!e.email || !e.email.includes('@')) return false;
    if (departmentFilter !== 'all' && departmentFilter !== '' && e.department !== departmentFilter) {
      return false;
    }
    return true;
  });

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Preset topics for quick 1-click inspiration
  const quickTopics = [
    {
      title: '🪔 Diwali Celebrations',
      topic: 'Diwali celebration this Friday with traditional attire, sweets distribution, games, and diya lighting at 4 PM in cafeteria',
      tone: 'Warm and Festive',
      type: 'Diwali & Festivals' as const,
    },
    {
      title: '🏖️ Holiday Notice',
      topic: 'Office closure announcement for upcoming national/state holiday with emergency support contact numbers',
      tone: 'Professional and Clear',
      type: 'Holiday Update' as const,
    },
    {
      title: '📋 Company Circular',
      topic: 'Official circular regarding updated attendance, remote working, and internal security guidelines',
      tone: 'Formal and Structured',
      type: 'Company Circular' as const,
    },
    {
      title: '🎉 Town Hall & Event',
      topic: 'Quarterly all-hands town hall meeting with executive leadership address, achievements recap, and Q&A',
      tone: 'Inspiring and Engaging',
      type: 'Event Announcement' as const,
    },
  ];

  async function handleGenerateAI(customTopic?: string, customTone?: string) {
    const topicToUse = customTopic || aiTopic;
    const toneToUse = customTone || aiTone;

    if (!topicToUse.trim()) {
      setError('Please enter a topic or select one of the quick templates.');
      return;
    }

    setAiGenerating(true);
    setError('');
    setAiSuccessMessage('');

    try {
      if (onGenerateEmail) {
        const result = await onGenerateEmail(topicToUse, toneToUse);
        setSubject(result.subject);
        setBody(result.body);
        if (result.campaignType) {
          setCampaignType(result.campaignType as EmailLog['campaignType']);
        }
        setAiSuccessMessage('✨ Content generated successfully! You can review or edit the text below.');
      } else {
        // Fallback local generator if callback is not passed
        const isDiwali = topicToUse.toLowerCase().includes('diwali') || topicToUse.toLowerCase().includes('festival');
        const companyName = company?.name || 'Our Company';
        if (isDiwali) {
          setSubject(`✨ Diwali Celebrations at ${companyName} — Lighting Up Together!`);
          setBody(`Dear {name},\n\nThe festival of lights is here! We warmly invite you to join our Diwali celebration at ${companyName}.\n\nDetails:\n• Date & Time: Friday, 4:00 PM onwards\n• Venue: Office Cafeteria\n• Dress Code: Festive / Ethnic Wear\n• Highlights: Diya ceremony, sweet boxes, fun games, and music!\n\n${topicToUse}\n\nWishing you and your family a safe, prosperous, and sparkling Diwali!\n\nWarm regards,\nHR & Culture Team\n${companyName}`);
          setCampaignType('Diwali & Festivals');
        } else {
          setSubject(`📢 Official Announcement: ${topicToUse.slice(0, 50)}`);
          setBody(`Dear {name},\n\nWe would like to share an important announcement with all team members at ${companyName}:\n\n${topicToUse}\n\nKindly note the instructions above and reach out to your reporting manager or HR for any queries.\n\nBest regards,\nHR Department\n${companyName}`);
          setCampaignType('General Notice');
        }
        setAiSuccessMessage('✨ Template generated! You can edit the text below.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate email content. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setMessage('Draft copied to clipboard.');
    } catch {
      setError('Clipboard access was unavailable. Please select and copy manually.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    try {
      if (sendMode === 'single') {
        if (!employeeId) {
          setError('Please select an employee.');
          setBusy(false);
          return;
        }
        const ok = await onSend({ employeeId, subject, body, campaignType });
        if (ok) {
          setMessage(`Email sent to ${employee?.name} (${employee?.email}) with Director, Reporting Manager & Accounts CC'd.`);
        }
      } else {
        // Mass broadcast
        if (!activeEmployees.length) {
          setError('No active employees found matching the target audience.');
          setBusy(false);
          return;
        }
        const confirmed = window.confirm(
          `Are you sure you want to send this mass email to ${activeEmployees.length} employees?\n\nSubject: ${subject}\n\nEach employee will receive a personalized email with Director, Reporting Manager, and Accounts automatically CC'd.`
        );
        if (!confirmed) {
          setBusy(false);
          return;
        }

        if (onSendMass) {
          const ok = await onSendMass({
            department: departmentFilter,
            subject,
            body,
            campaignType,
          });
          if (ok) {
            setMessage(`🚀 Mass email successfully dispatched to ${activeEmployees.length} employees with personalized greetings and automatic CCs!`);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send email. Check mail server settings.');
    } finally {
      setBusy(false);
    }
  }

  const singleReady = !!employee && !!subject.trim() && !!body.trim();
  const massReady = activeEmployees.length > 0 && !!subject.trim() && !!body.trim();
  const isReady = sendMode === 'single' ? singleReady : massReady;

  const mailtoCc = previewCcEmails.length ? `&cc=${encodeURIComponent(previewCcEmails.join(','))}` : '';
  const gmailCc = previewCcEmails.length ? `&cc=${encodeURIComponent(previewCcEmails.join(','))}` : '';

  const filteredLogs = filterType === 'all'
    ? emailLogs
    : emailLogs.filter(log => log.campaignType === filterType || log.status === filterType);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Email & Communications Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Send personalized employee notices or company-wide mass announcements via Zoho Mail with automatic CC compliance.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => { setSendMode('single'); setMessage(''); setError(''); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sendMode === 'single'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            👤 Single Employee
          </button>
          <button
            type="button"
            onClick={() => { setSendMode('mass'); setMessage(''); setError(''); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sendMode === 'mass'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            📢 Mass Email Broadcast
          </button>
        </div>
      </div>

      {!mailConfigured && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 rounded-xl text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <strong>Zoho Mail is not yet fully configured with credentials.</strong>
            <p className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
              Add your Zoho email and app password in <code>.env.local</code> to send live emails. You can still generate content and open drafts in the email app.
            </p>
          </div>
        </div>
      )}

      {/* AI Content & Structure Generator Card */}
      <section className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-pink-50/50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/20 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs">
              ✨
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              AI Email Content & Structure Generator
            </h2>
          </div>
          <span className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 px-2.5 py-0.5 rounded-full font-medium">
            Gemini & Smart Template Engine
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Click any quick preset or type any custom topic (e.g. Diwali celebrations, festival gifts, office holidays, circulars, town halls) to automatically draft a polished subject line and body structure.
        </p>

        {/* Quick Topic Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {quickTopics.map(preset => (
            <button
              key={preset.title}
              type="button"
              onClick={() => {
                setAiTopic(preset.topic);
                setAiTone(preset.tone);
                handleGenerateAI(preset.topic, preset.tone);
              }}
              className="text-xs bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-medium transition-all shadow-2xs hover:shadow-xs active:scale-95"
            >
              {preset.title}
            </button>
          ))}
        </div>

        {/* Custom Prompt Input & Tone */}
        <div className="grid md:grid-cols-4 gap-3 pt-1">
          <div className="md:col-span-3">
            <input
              type="text"
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              placeholder="Or type custom instructions: e.g. Diwali party this Friday at 4 PM in cafeteria with traditional dress code"
              className="w-full text-xs px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={aiTone}
              onChange={e => setAiTone(e.target.value)}
              className="text-xs px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium outline-none"
            >
              <option>Warm and Festive</option>
              <option>Professional and Formal</option>
              <option>Inspiring and Celebratory</option>
              <option>Clear and Concise</option>
            </select>
            <button
              type="button"
              disabled={aiGenerating || !aiTopic.trim()}
              onClick={() => handleGenerateAI()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all flex items-center justify-center gap-1.5"
            >
              {aiGenerating ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Drafting…</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiSuccessMessage && (
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-100/60 dark:bg-indigo-900/40 p-2 rounded-lg">
            {aiSuccessMessage}
          </p>
        )}
      </section>

      {/* Main Composer Form */}
      <form onSubmit={handleSubmit} className="account-panel space-y-4">
        <ErrorMessage message={error} />
        {message && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl font-medium" role="status">
            {message}
          </div>
        )}

        <fieldset disabled={busy} className="space-y-4">
          {/* Target Audience Bar */}
          {sendMode === 'single' ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Recipient Employee">
                <select
                  required
                  value={employeeId}
                  onChange={event => {
                    setEmployeeId(event.target.value);
                    setMessage('');
                  }}
                  className="w-full text-sm rounded-lg"
                >
                  <option value="">Choose employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.email} ({emp.department || 'General'})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Category / Campaign Type">
                <select
                  value={campaignType}
                  onChange={e => setCampaignType(e.target.value as EmailLog['campaignType'])}
                  className="w-full text-sm rounded-lg"
                >
                  <option>General Notice</option>
                  <option>Diwali & Festivals</option>
                  <option>Holiday Update</option>
                  <option>Company Circular</option>
                  <option>Event Announcement</option>
                  <option>Birthday</option>
                  <option>Work Anniversary</option>
                  <option>Payslip</option>
                </select>
              </Field>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Target Department / Audience">
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="w-full text-sm rounded-lg font-medium"
                >
                  <option value="all">🌐 All Active Employees ({activeEmployees.length} recipients)</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>
                      🏢 {dept} Department
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Category / Campaign Type">
                <select
                  value={campaignType}
                  onChange={e => setCampaignType(e.target.value as EmailLog['campaignType'])}
                  className="w-full text-sm rounded-lg"
                >
                  <option>General Notice</option>
                  <option>Diwali & Festivals</option>
                  <option>Holiday Update</option>
                  <option>Company Circular</option>
                  <option>Event Announcement</option>
                  <option>Birthday</option>
                  <option>Work Anniversary</option>
                  <option>Payslip</option>
                </select>
              </Field>
            </div>
          )}

          {/* Automatic CC Compliance Preview Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-2 text-slate-600 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="text-blue-600 dark:text-blue-400">🔒</span>
                <span>Automatic CC Rule Enforced (Director, Reporting Manager & Accounts)</span>
              </span>
              {sendMode === 'mass' && (
                <span className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full font-bold">
                  {activeEmployees.length} Personalized Emails
                </span>
              )}
            </div>

            {sendMode === 'single' ? (
              <div className="grid sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Reporting Manager: </span>
                  <span>{manager ? `${manager.name} (${manager.email})` : '(Assigned in employee profile)'}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Director: </span>
                  <span>{director ? `${director.name} (${director.email})` : 'Company Director / Owner'}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Accounts: </span>
                  <span>{accounts ? `${accounts.name} (${accounts.email})` : 'Accounts & Finance'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                Each employee will receive their individual email. The server automatically injects the employee's specific Reporting Manager, Company Director, and Accounts department on CC.
              </p>
            )}
          </div>

          {/* Subject Field */}
          <Field label="Email Subject">
            <input
              required
              maxLength={200}
              value={subject}
              onChange={event => setSubject(event.target.value)}
              placeholder="e.g. ✨ Diwali Celebrations & Office Gathering"
              className="w-full font-medium"
            />
          </Field>

          {/* Message Body Field */}
          <Field label="Message Body (Supports {name} and {companyName} placeholders)">
            <textarea
              required
              rows={11}
              maxLength={15000}
              value={body}
              onChange={event => setBody(event.target.value)}
              placeholder="Write your email here. Use {name} for employee name, e.g. 'Dear {name},'"
              className="w-full font-mono text-xs leading-relaxed"
            />
          </Field>

          {/* Footer Actions */}
          <div className="flex flex-wrap gap-4 items-center pt-2">
            <button
              type="button"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 underline"
              disabled={!body.trim()}
              onClick={() => void copy()}
            >
              📋 Copy Draft
            </button>

            {sendMode === 'single' && employee && (
              <>
                <a
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 underline"
                  href={`mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${mailtoCc}`}
                >
                  ✉️ Open Email App
                </a>
                <a
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(employee.email)}${gmailCc}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                >
                  📬 Open Gmail Draft
                </a>
              </>
            )}

            <button
              type="submit"
              disabled={!isReady || !mailConfigured || busy}
              className={`ml-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                sendMode === 'mass'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {busy ? (
                sendMode === 'mass' ? `Broadcasting to ${activeEmployees.length} employees…` : 'Sending…'
              ) : sendMode === 'mass' ? (
                `🚀 Send Mass Broadcast (${activeEmployees.length} Employees)`
              ) : (
                'Send Email Now'
              )}
            </button>
          </div>
        </fieldset>
      </form>

      {/* Outbox History */}
      <section className="account-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Outbox & Broadcast History</h2>
            <p className="text-xs text-slate-500">
              Persistent record of all single and mass communications sent through Zoho Mail with CC audit tracking.
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['all', 'Accepted', 'Failed', 'Diwali & Festivals', 'Holiday Update', 'Company Circular'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterType(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filterType === cat
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Logs' : cat}
              </button>
            ))}
          </div>
        </div>

        {!filteredLogs.length ? (
          <p className="text-sm text-slate-500 py-6 text-center">No email history found for this view.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredLogs.map(log => {
              const isAccepted = log.status === 'Accepted';
              return (
                <details key={log.id} className="py-3.5 group">
                  <summary className="cursor-pointer text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isAccepted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      }`}>
                        {log.status}
                      </span>
                      {log.campaignType && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {log.campaignType}
                        </span>
                      )}
                      <strong className="text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                        {log.subject}
                      </strong>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <span>To: <strong>{log.employeeName}</strong> ({log.recipientEmail})</span>
                      <span className="mx-1.5">·</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </summary>

                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                    {log.cc && log.cc.length > 0 && (
                      <div className="text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-slate-800 dark:text-slate-200">CC:</span> {log.cc.join(', ')}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
                      {log.body}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
