import { useEffect, useState } from "react";
import { gravatarUrl } from "../lib/gravatar";

function authorHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 48% 42%)`;
}

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Roundness = "full" | "md" | "xl" | "sm";

const roundClass: Record<Roundness, string> = {
  full: "rounded-full",
  sm: "rounded-sm",
  md: "rounded-md",
  xl: "rounded-xl",
};

/**
 * Gravatar when the email has one; otherwise colored initials.
 * CSP must allow https://www.gravatar.com in img-src.
 */
export function UserAvatar({
  name,
  email,
  size = 24,
  rounded = "full",
  className = "",
  title,
  gradientFallback = false,
}: {
  name: string;
  email?: string | null;
  size?: number;
  rounded?: Roundness;
  className?: string;
  title?: string;
  /** Purple gradient letter (profiles) instead of hue-from-email. */
  gradientFallback?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [email]);
  const url = !failed && email ? gravatarUrl(email, size * 2) : null;
  const initials = authorInitials(name || email || "?");
  const tip = title ?? (email ? `${name} <${email}>` : name);
  const shape = roundClass[rounded];

  if (url) {
    return (
      <img
        src={url}
        alt=""
        title={tip}
        width={size}
        height={size}
        className={`shrink-0 object-cover ${shape} ${className}`}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  const letter = gradientFallback
    ? name.trim().slice(0, 1).toUpperCase() || "?"
    : initials;

  return (
    <span
      title={tip}
      className={`inline-flex shrink-0 items-center justify-center font-medium text-white ${shape} ${
        gradientFallback
          ? "bg-gradient-to-br from-[#6b5cff] to-[#e040a0] font-semibold"
          : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.floor(size * (gradientFallback ? 0.38 : 0.42))),
        ...(gradientFallback ? {} : { background: authorHue(email || name) }),
      }}
    >
      {letter}
    </span>
  );
}
