import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { CATEGORIES, EXPERIENCE_LEVELS, MODES, PAY_CURRENCIES, PAY_PERIODS, jobsApi, type WorkMode } from "../api";
import { TopBar } from "../ui";
import { isDateKeyBeforeToday, isValidDateKey, localDateKey } from "../job-logic.js";

type Errors = Partial<Record<string, string>>;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Field({ label, hint, error, children }: { name: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="field">{label}{hint && <small>{hint}</small>}{children}{error && <em className="err" role="alert">{error}</em>}</label>;
}

export default function Post() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    if (v("website")) { setDone(true); return; } // honeypot: bots fill hidden fields
    const err: Errors = {};
    if (v("title").length < 3) err.title = "Enter a job title.";
    if (v("employer").length < 2) err.employer = "Enter the employer name.";
    if (v("location").length < 2) err.location = "Enter a location.";
    if (!v("pay")) err.pay = "Enter the pay or budget.";
    const salaryMin = v("salaryMin") ? Number(v("salaryMin")) : null;
    const salaryMax = v("salaryMax") ? Number(v("salaryMax")) : null;
    if (salaryMin !== null && (!Number.isFinite(salaryMin) || salaryMin < 0)) err.salaryMin = "Enter a valid non-negative amount.";
    if (salaryMax !== null && (!Number.isFinite(salaryMax) || salaryMax < 0)) err.salaryMax = "Enter a valid non-negative amount.";
    if ((salaryMin === null) !== (salaryMax === null)) err.salaryMax = "Enter both salary amounts, or leave both blank.";
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) err.salaryMax = "Maximum pay must be at least the minimum.";
    if (v("deadline") && (!isValidDateKey(v("deadline")) || isDateKeyBeforeToday(v("deadline")))) err.deadline = "Choose a valid closing date today or later.";
    if (v("summary").length < 20) err.summary = "Describe the work in at least 20 characters.";
    if (v("requirements").length < 2) err.requirements = "List at least one requirement.";
    if (v("phone") && !PHONE.test(v("phone"))) err.phone = "Use digits, spaces, + or dashes.";
    if (v("whatsapp") && !PHONE.test(v("whatsapp"))) err.whatsapp = "Use digits, spaces, + or dashes.";
    if (v("email") && !EMAIL.test(v("email"))) err.email = "Enter a valid email.";
    if (!v("phone") && !v("whatsapp") && !v("email")) err.contact = "Add at least one way to contact you.";
    setErrors(err); setFormError("");
    if (Object.keys(err).length) { document.querySelector<HTMLElement>("[data-invalid='true']")?.focus(); return; }
    setBusy(true);
    try {
      await jobsApi.create({
        title: v("title"), employerName: v("employer"), location: v("location"), category: v("category"),
        mode: v("mode") as WorkMode, pay: v("pay"), description: v("summary"), requirements: v("requirements"),
        salaryMin, salaryMax, salaryCurrency: v("salaryCurrency") || "UGX", payPeriod: v("payPeriod") || null,
        experienceLevel: v("experienceLevel") || null, applicationDeadline: v("deadline") || null,
        phone: v("phone") || null, whatsApp: v("whatsapp") || null, email: v("email") || null,
      });
      setDone(true);
    } catch (x) { setFormError(x instanceof Error ? x.message : "Could not submit job."); }
    finally { setBusy(false); }
  };

  if (done) return (
    <div className="screen full">
      <TopBar title="Post a job" />
      <div className="state success"><span className="pop"><CheckCircle2 size={52} /></span><h3>Job submitted for review</h3><p>Thanks. Your listing is awaiting review and will appear to workers once approved. After publication, it stays online for up to 30 days.</p><button className="btn btn-primary" onClick={() => nav("/", { replace: true })}>Back to jobs</button></div>
    </div>
  );

  const inv = (k: string) => ({ "data-invalid": errors[k] ? "true" : undefined, "aria-invalid": !!errors[k] });

  return (
    <form className="screen full" onSubmit={submit} noValidate>
      <TopBar title="Post a job" />
      <div className="form">
        <p className="form-intro">Submit a clear listing. It will be reviewed before it appears to workers.</p>
        {formError && <div className="banner-err" role="alert">{formError}</div>}

        <fieldset><legend>The job</legend>
          <Field name="title" error={errors.title} label="Job title"><input name="title" maxLength={160} placeholder="e.g. Site mason" autoComplete="off" {...inv("title")} /></Field>
          <Field name="employer" error={errors.employer} label="Employer or company"><input name="employer" maxLength={160} autoComplete="organization" {...inv("employer")} /></Field>
          <div className="two">
            <Field name="location" error={errors.location} label="Location"><input name="location" maxLength={120} {...inv("location")} /></Field>
            <Field name="pay" error={errors.pay} label="Pay or budget"><input name="pay" maxLength={120} placeholder="UGX 50,000/day" {...inv("pay")} /></Field>
          </div>
          <div className="two">
            <Field name="category" error={errors.category} label="Category"><select name="category" defaultValue="Other">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field name="mode" error={errors.mode} label="Work type"><select name="mode" defaultValue="OnSite">{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
          </div>
          <Field name="summary" error={errors.summary} label="What will the worker do?"><textarea name="summary" rows={5} maxLength={5000} {...inv("summary")} /></Field>
          <Field name="requirements" error={errors.requirements} label="Requirements" hint="Separate with commas"><input name="requirements" maxLength={1000} placeholder="Experience, own tools, licence" {...inv("requirements")} /></Field>
          <div className="two">
            <Field name="experienceLevel" label="Experience level"><select name="experienceLevel" defaultValue=""><option value="">Not specified</option>{EXPERIENCE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></Field>
            <Field name="deadline" error={errors.deadline} label="Application deadline"><input name="deadline" type="date" min={localDateKey(new Date())} {...inv("deadline")} /></Field>
          </div>
          <fieldset className="salary-structure"><legend>Optional salary range for better matching</legend><p className="form-hint">Keep the pay description above. Add numeric amounts if you want workers to filter this job by pay.</p>
            <div className="two"><Field name="salaryMin" error={errors.salaryMin} label="Minimum amount"><input name="salaryMin" type="number" min="0" step="any" inputMode="decimal" placeholder="Optional" {...inv("salaryMin")} /></Field><Field name="salaryMax" error={errors.salaryMax} label="Maximum amount"><input name="salaryMax" type="number" min="0" step="any" inputMode="decimal" placeholder="Optional" {...inv("salaryMax")} /></Field></div>
            <div className="two"><Field name="salaryCurrency" label="Currency"><select name="salaryCurrency" defaultValue="UGX">{PAY_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></Field><Field name="payPeriod" label="Pay period"><select name="payPeriod" defaultValue=""><option value="">Not specified</option>{PAY_PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}</select></Field></div>
          </fieldset>
        </fieldset>

        <fieldset><legend>How workers reach you</legend>
          {errors.contact && <em className="err" role="alert">{errors.contact}</em>}
          <div className="two">
            <Field name="phone" error={errors.phone} label="Phone"><input name="phone" type="tel" inputMode="tel" maxLength={20} placeholder="+256 7XX XXX XXX" {...inv("phone")} /></Field>
            <Field name="whatsapp" error={errors.whatsapp} label="WhatsApp"><input name="whatsapp" type="tel" inputMode="tel" maxLength={20} placeholder="+256 7XX XXX XXX" {...inv("whatsapp")} /></Field>
          </div>
          <Field name="email" error={errors.email} label="Email"><input name="email" type="email" inputMode="email" maxLength={254} autoComplete="email" {...inv("email")} /></Field>
        </fieldset>
        <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <div className="actionbar"><button className="btn btn-primary grow" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} />Posting</> : "Post job"}</button></div>
    </form>
  );
}
