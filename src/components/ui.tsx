import { Fragment, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { IAlert, IArrowL, IFlame, IInfo, IX } from "./Icons";

type IconT = ComponentType<SVGProps<SVGSVGElement>>;

/** Sticky top bar. `back` shows a back arrow (history back, or `fallback` when opened directly). */
export function AppBar({ title, sub, back, fallback = "/", actions, large }: { title: ReactNode; sub?: ReactNode; back?: boolean; fallback?: string; actions?: ReactNode; large?: boolean }) {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`appbar ${scrolled ? "scrolled" : ""} ${large ? "large" : ""}`}>
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => (window.history.state?.idx > 0 ? nav(-1) : nav(fallback))}>
          <IArrowL />
        </button>
      )}
      <div className="appbar-title">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions}
    </header>
  );
}

export function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warning" | "critical"; children: ReactNode }) {
  const Icon = tone === "critical" || tone === "warning" ? IAlert : IInfo;
  return (
    <div className={`notice notice-${tone}`} role={tone === "critical" ? "alert" : undefined}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon: Icon = IInfo, title, children }: { icon?: IconT; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon />
      </span>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: "good" | "flame" }) {
  return (
    <div className={`bar thin ${tone ?? ""}`} aria-hidden="true">
      <span style={{ width: `${max && value ? Math.max(2, (100 * value) / max) : 0}%` }} />
    </div>
  );
}

export function RepeatBadge({ papers }: { papers: number }) {
  if (papers > 1)
    return (
      <span className="chip chip-flame" title={`Asked in ${papers} different papers`}>
        <IFlame /> Asked {papers}×
      </span>
    );
  return null;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="switch-row">
      <div className="li-body">
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

/** Choice chips: single (`multi` false) or multi select. Empty selection means "any". */
export function Choices({ label, options, value, onChange, multi = true }: { label: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="opt-group" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="choice-grid">
        <button type="button" className="choice" aria-pressed={!value.length} onClick={() => onChange([])}>
          Any
        </button>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className="choice"
            aria-pressed={value.includes(v)}
            onClick={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : multi ? [...value, v] : [v])}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, label, format = String }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; format?: (n: number) => string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        −
      </button>
      <output aria-live="polite">{format(value)}</output>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

/** Bottom sheet dialog. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <IX />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

/** Tiny markdown subset used by explanations: **bold**, `code`, "- " bullets, blank-line paragraphs. */
export function Md({ text }: { text: string }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const isLi = /^\s*[-•]\s+/.test(line);
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (isLi) {
      if (last?.kind === "ul") last.lines.push(line.replace(/^\s*[-•]\s+/, ""));
      else blocks.push({ kind: "ul", lines: [line.replace(/^\s*[-•]\s+/, "")] });
    } else if (last?.kind === "p" && last.lines.length) last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className="md">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === "ul" ? (
            <ul key={i}>
              {b.lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Inline text={l} />
                </Fragment>
              ))}
            </p>
          ),
        )}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("`") && p.endsWith("`") ? (
          <code key={i}>{p.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Short-lived status message. */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  return [
    msg ? (
      <div className="toast" role="status">
        {msg}
      </div>
    ) : null,
    setMsg,
  ];
}
