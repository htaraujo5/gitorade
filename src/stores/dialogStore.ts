import { create } from "zustand";

export type DialogField = {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
  /** Returns an error message when the value is invalid. */
  validate?: (value: string) => string | null;
};

export type DialogChoice = {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
};

type Base = {
  id: number;
  title: string;
  message?: string;
};

export type DialogRequest =
  | (Base & {
      kind: "confirm";
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      resolve: (ok: boolean) => void;
    })
  | (Base & {
      kind: "prompt";
      fields: DialogField[];
      confirmLabel?: string;
      resolve: (values: Record<string, string> | null) => void;
    })
  | (Base & {
      kind: "choice";
      choices: DialogChoice[];
      defaultChoice?: string;
      confirmLabel?: string;
      resolve: (id: string | null) => void;
    })
  | (Base & {
      kind: "alert";
      tone?: "error" | "info";
      resolve: () => void;
    });

type DialogState = {
  queue: DialogRequest[];
  push: (req: DialogRequest) => void;
  shift: () => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  queue: [],
  push: (req) => set((s) => ({ queue: [...s.queue, req] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

let nextId = 1;

type Without<T> = T extends unknown ? Omit<T, "id" | "resolve" | "kind"> : never;

function enqueue<T>(kind: DialogRequest["kind"], opts: object): Promise<T> {
  return new Promise<T>((resolve) => {
    useDialogStore.getState().push({
      ...opts,
      kind,
      id: nextId++,
      resolve,
    } as unknown as DialogRequest);
  });
}

export function confirmDialog(
  opts: Without<Extract<DialogRequest, { kind: "confirm" }>>,
): Promise<boolean> {
  return enqueue<boolean>("confirm", opts);
}

export function promptDialog(
  opts: Without<Extract<DialogRequest, { kind: "prompt" }>>,
): Promise<Record<string, string> | null> {
  return enqueue<Record<string, string> | null>("prompt", opts);
}

/** Single text field shortcut. Resolves to the trimmed value or null when cancelled/empty. */
export async function promptText(opts: {
  title: string;
  label: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
}): Promise<string | null> {
  const values = await promptDialog({
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel,
    fields: [
      {
        name: "value",
        label: opts.label,
        defaultValue: opts.defaultValue,
        placeholder: opts.placeholder,
        required: true,
        validate: opts.validate,
      },
    ],
  });
  const value = values?.value.trim();
  return value ? value : null;
}

export function choiceDialog(
  opts: Without<Extract<DialogRequest, { kind: "choice" }>>,
): Promise<string | null> {
  return enqueue<string | null>("choice", opts);
}

export function alertDialog(
  opts: Without<Extract<DialogRequest, { kind: "alert" }>>,
): Promise<void> {
  return enqueue<void>("alert", opts);
}
