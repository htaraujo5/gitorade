import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDialogStore, type DialogRequest } from "../stores/dialogStore";
import { useT } from "../i18n";

/** Renders the head of the dialog queue (confirm / prompt / choice / alert). */
export function DialogHost() {
  const current = useDialogStore((s) => s.queue[0] ?? null);
  if (!current) return null;
  return <DialogView key={current.id} req={current} />;
}

function DialogView({ req }: { req: DialogRequest }) {
  const t = useT();
  const shift = useDialogStore((s) => s.shift);
  const [values, setValues] = useState<Record<string, string>>(() =>
    req.kind === "prompt"
      ? Object.fromEntries(req.fields.map((f) => [f.name, f.defaultValue ?? ""]))
      : {},
  );
  const [choice, setChoice] = useState<string | null>(() =>
    req.kind === "choice" ? (req.defaultChoice ?? req.choices[0]?.id ?? null) : null,
  );
  const [touched, setTouched] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = firstInputRef.current;
    if (el) {
      el.focus();
      if ("select" in el) el.select();
    } else {
      confirmRef.current?.focus();
    }
  }, []);

  const finish = (ok: boolean) => {
    shift();
    switch (req.kind) {
      case "confirm":
        req.resolve(ok);
        break;
      case "prompt":
        req.resolve(ok ? values : null);
        break;
      case "choice":
        req.resolve(ok ? choice : null);
        break;
      case "alert":
        req.resolve();
        break;
    }
  };

  const fieldErrors: Record<string, string | null> =
    req.kind === "prompt"
      ? Object.fromEntries(
          req.fields.map((f) => {
            const v = values[f.name] ?? "";
            if (f.required && !v.trim()) return [f.name, "Campo obrigatório."];
            return [f.name, f.validate ? f.validate(v) : null];
          }),
        )
      : {};
  const hasErrors = Object.values(fieldErrors).some(Boolean);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (req.kind === "prompt" && hasErrors) return;
    if (req.kind === "choice" && !choice) return;
    finish(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const danger = req.kind === "confirm" && req.danger;
  const isError = req.kind === "alert" && req.tone === "error";
  const confirmLabel =
    req.kind === "alert"
      ? "OK"
      : req.kind === "confirm"
        ? (req.confirmLabel ?? "Confirmar")
        : (req.confirmLabel ?? "OK");

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-4"
      role={req.kind === "alert" || danger ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={`gitorade-dialog-${req.id}`}
      onMouseDown={() => finish(false)}
    >
      <form
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-3 border-b border-[#2d3139] px-4 py-3">
          {(danger || isError) && (
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f85149]/20 text-[12px] font-bold text-[#f85149]">
              !
            </span>
          )}
          <h2
            id={`gitorade-dialog-${req.id}`}
            className="min-w-0 flex-1 pt-0.5 text-[14px] font-medium text-[#f0f1f4]"
          >
            {req.title}
          </h2>
          <button
            type="button"
            className="rounded px-1.5 text-[16px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
            onClick={() => finish(false)}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {req.message && (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#c8ccd4]">
              {req.message}
            </p>
          )}

          {req.kind === "prompt" &&
            req.fields.map((field, idx) => {
              const err = touched ? fieldErrors[field.name] : null;
              const common = {
                value: values[field.name] ?? "",
                placeholder: field.placeholder,
                onChange: (e: { target: { value: string } }) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value })),
                className: `w-full rounded border bg-[#12141a] px-3 text-[13px] text-[#f0f1f4] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7] ${
                  err ? "border-[#f85149]" : "border-[#3a3f4b]"
                }`,
              };
              return (
                <label key={field.name} className="block text-[11px] font-medium text-[#8b909a]">
                  {field.label}
                  <div className="mt-1">
                    {field.multiline ? (
                      <textarea
                        {...common}
                        ref={idx === 0 ? (el) => void (firstInputRef.current = el) : undefined}
                        rows={4}
                        className={`${common.className} resize-y py-2`}
                      />
                    ) : (
                      <input
                        {...common}
                        ref={idx === 0 ? (el) => void (firstInputRef.current = el) : undefined}
                        className={`${common.className} h-9`}
                      />
                    )}
                  </div>
                  {err ? (
                    <span className="mt-1 block text-[10px] font-normal text-[#f85149]">{err}</span>
                  ) : field.hint ? (
                    <span className="mt-1 block text-[10px] font-normal text-[#6b7280]">
                      {field.hint}
                    </span>
                  ) : null}
                </label>
              );
            })}

          {req.kind === "choice" && (
            <div className="flex flex-col gap-1.5" role="radiogroup">
              {req.choices.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-2 rounded border px-2.5 py-2 text-[12px] ${
                    choice === c.id
                      ? "border-[#a371f7]/70 bg-[#a371f7]/10"
                      : "border-[#2d3139] hover:bg-[#252830]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`dialog-choice-${req.id}`}
                    checked={choice === c.id}
                    onChange={() => setChoice(c.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-[#a371f7]"
                  />
                  <span className="min-w-0">
                    <span className={c.danger ? "text-[#f85149]" : "text-[#e8eaed]"}>
                      {c.label}
                    </span>
                    {c.description && (
                      <span className="mt-0.5 block text-[11px] text-[#8b909a]">
                        {c.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2d3139] px-4 py-2.5">
          {req.kind !== "alert" && (
            <button
              type="button"
              onClick={() => finish(false)}
              className="h-8 min-w-[88px] rounded border border-[#3a3f4b] px-4 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
            >
              {req.kind === "confirm" && req.cancelLabel ? req.cancelLabel : t("common.cancel")}
            </button>
          )}
          <button
            ref={confirmRef}
            type="submit"
            disabled={touched && req.kind === "prompt" && hasErrors}
            className={`h-8 min-w-[88px] rounded border px-4 text-[12px] font-medium text-[#e8eaed] disabled:opacity-40 ${
              danger
                ? "border-[#f85149] bg-[#f85149]/20 hover:bg-[#f85149]/30"
                : "border-[#a371f7] bg-[#a371f7]/15 hover:bg-[#a371f7]/25"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
