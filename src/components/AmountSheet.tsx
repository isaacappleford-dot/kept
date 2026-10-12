import { useEffect, useState } from 'react';
import { centsToInput, parseAmount } from '../lib/money';
import { Button, Sheet } from './ui';

/** Asks for one amount ("How much did you get back?"). */
export function AmountSheet({
  open,
  title,
  hint,
  initial,
  confirmLabel,
  optional,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint: string;
  initial: number | null;
  confirmLabel: string;
  optional?: boolean;
  onClose: () => void;
  onConfirm: (cents: number | null) => void | Promise<void>;
}) {
  const [text, setText] = useState(centsToInput(initial));
  useEffect(() => {
    if (open) setText(centsToInput(initial));
  }, [open, initial]);
  const value = text.trim() ? parseAmount(text) : null;
  const ok = optional ? value === null || value >= 0 : value !== null && value > 0;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) void onConfirm(value);
        }}
      >
        <p className="mb-3 px-1 text-center text-[14px] text-white/65">{hint}</p>
        <input
          inputMode="decimal"
          aria-label="Amount"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="0.00"
          className="mb-4 block w-full rounded-2xl bg-white/10 px-4 py-3 text-center text-[28px] font-semibold tabular text-white placeholder:text-white/30 focus:outline focus:outline-2 focus:outline-accent"
        />
        <Button type="submit" disabled={!ok} className="w-full">
          {confirmLabel}
        </Button>
      </form>
    </Sheet>
  );
}
