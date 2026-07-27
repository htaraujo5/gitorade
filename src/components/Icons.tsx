/** Line icons — thin stroke, round caps (GitKraken-like). */

type IconProps = { className?: string; title?: string };

const base = "h-4 w-4 shrink-0";

function iconClass(className?: string) {
  if (!className) return base;
  if (/\bh-/.test(className)) {
    return className.includes("shrink-") ? className : `${className} shrink-0`;
  }
  return `${base} ${className}`;
}

const svgProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
};

export function IconDashboard({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function IconRepos({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconStar({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="m12 3 2.6 5.4 6 .9-4.3 4.2 1 5.9L12 16.8 6.7 19.4l1-5.9L3.4 9.3l6-.9Z" />
    </svg>
  );
}

export function IconHistory({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 5v4h4" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

export function IconCredentials({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 11h5M14 15h3" />
    </svg>
  );
}

export function IconKey({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M11 12.5 20 4l2 2-2 2-2-1-3 3" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconPlugins({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M8 3v4M16 3v4M5 7h14v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V7Z" />
      <path d="M12 16v5" />
    </svg>
  );
}

export function IconAbout({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </svg>
  );
}

export function IconCommit({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v5.5M12 15.5V21" />
    </svg>
  );
}

export function IconPull({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M12 4v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function IconPush({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M12 20V8" />
      <path d="m7 12 5-5 5 5" />
      <path d="M5 4h14" />
    </svg>
  );
}

export function IconFetch({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <path d="M4 20v-5h5" />
    </svg>
  );
}

export function IconBranch({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 7.5v9M8.5 5.5c4 0 7 2.5 7 6.5" />
    </svg>
  );
}

/** Laptop / local branch indicator (GitKraken-style). */
export function IconLaptop({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M2 18h20M8 18v1.5h8V18" />
    </svg>
  );
}

/** Cloud / remote branch indicator. */
export function IconCloud({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M7 17h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.5A3.5 3.5 0 0 0 7 17Z" />
    </svg>
  );
}

/** GitHub mark for remotes hosted on github.com. */
export function IconGithub({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        stroke="none"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.59.69.48A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

/** Price-tag icon for git tags. */
export function IconTag({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M3 12.5V4.5A1.5 1.5 0 0 1 4.5 3h8l8.5 8.5-8 8.5L3 12.5Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMerge({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v7M8.2 16.5c3.5-1 6.3-3.5 7.8-7" />
    </svg>
  );
}

export function IconStash({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M4 8h16l-1.5 11H5.5L4 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function IconCloudSync({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M7 17h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.5A3.5 3.5 0 0 0 7 17Z" />
      <path d="M12 11v5M10 14.5 12 16.5 14 14.5" />
    </svg>
  );
}

export function IconTerminal({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 10 3 2-3 2M13 14h4" />
    </svg>
  );
}

export function IconFiles({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M7 4h7l4 4v12H7z" />
      <path d="M14 4v4h4" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M4 12a8 8 0 0 1 13.5-5.8" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-13.5 5.8" />
      <path d="M4 20v-5h5" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={iconClass(className)} {...svgProps}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
