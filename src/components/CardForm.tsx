import { useMemo, useState, type ReactNode } from 'react';
import { CATEGORIES, STORES, type CategoryId } from '../config/policies';
import type { CardDraft, CardKind, LineItem } from '../data/types';
import { KIND_LABEL } from '../data/types';
import { suggestReturnBy, suggestWarranty } from '../deadlines/policy';
import { isISODate, type ISODate } from '../lib/dates';
import { centsToInput, parseAmount } from '../lib/money';
import { withSuggestions, type FixedField } from '../scan/toDraft';
import type { ParsedReceipt } from '../scan/parseReceipt';
import { Icon } from './Icon';
import { Button, Chip, Field, Section, TextInput, Toggle } from './ui';

type Unsure = ParsedReceipt['unsure'][number];

/** Money input that keeps what the user typed until blur. */
function MoneyInput({ value, onChange, label, placeholder = '0.00' }: { value: number | null; onChange: (v: number | null) => void; label: string; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <TextInput
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={text ?? centsToInput(value)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() ? parseAmount(e.target.value) : null);
      }}
      onBlur={() => setText(null)}
    />
  );
}

function DateInput({ value, onChange, label, optional }: { value: ISODate | null; onChange: (v: ISODate | null) => void; label: string; optional?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <TextInput type="date" aria-label={label} value={value ?? ''} onChange={(e) => onChange(isISODate(e.target.value) ? e.target.value : null)} className="flex-1" />
      {optional && value && (
        <button type="button" className="min-h-[40px] px-2 text-[13px] text-white/50" onClick={() => onChange(null)} aria-label={`Clear ${label}`}>
          Clear
        </button>
      )}
    </span>
  );
}

function Suggestion({ text, onUse, show }: { text: string; onUse?: () => void; show: boolean }) {
  return (
    <>
      {text}
      {show && onUse && (
        <>
          {' '}
          <button type="button" className="font-semibold text-accent" onClick={onUse}>
            Use suggestion
          </button>
        </>
      )}
    </>
  );
}

export interface CardFormProps {
  initial: CardDraft;
  unsure?: Unsure[];
  fixed?: FixedField[];
  imageUrl?: string | null;
  heading?: ReactNode;
  saveLabel: string;
  onSave: (d: CardDraft) => void | Promise<void>;
  onCancel: () => void;
}

export function CardForm({ initial, unsure = [], fixed: initialFixed = [], imageUrl, heading, saveLabel, onSave, onCancel }: CardFormProps) {
  const [d, setD] = useState<CardDraft>(initial);
  const [fixed, setFixed] = useState<FixedField[]>(initialFixed);
  const [checked, setChecked] = useState<Set<Unsure>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const isPurchase = d.kind === 'purchase';

  /** Updates fields and re-suggests dates the user hasn't set by hand. */
  const update = (patch: Partial<CardDraft>, touched?: Unsure) => {
    setD((prev) => withSuggestions({ ...prev, ...patch }, fixed));
    if (touched) setChecked((s) => new Set(s).add(touched));
  };
  const setFixedDate = (field: FixedField, v: ISODate | null) => {
    if (!fixed.includes(field)) setFixed([...fixed, field]);
    setD((prev) => ({ ...prev, [field]: v }));
  };
  const unfix = (field: FixedField) => {
    const next = fixed.filter((f) => f !== field);
    setFixed(next);
    setD((prev) => withSuggestions(prev, next));
  };
  const isUnsure = (f: Unsure) => unsure.includes(f) && !checked.has(f);

  const ret = useMemo(() => (isPurchase ? suggestReturnBy(d) : null), [isPurchase, d]);
  const war = useMemo(() => (isPurchase ? suggestWarranty(d.category, d.online && d.deliveryDate ? d.deliveryDate : d.date) : null), [isPurchase, d.category, d.online, d.deliveryDate, d.date]);

  const setItem = (i: number, patch: Partial<LineItem>) => update({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }, 'items');
  const valid = isISODate(d.date) && (d.store.trim() || d.title.trim() || d.items.length > 0);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const clean: CardDraft = {
        ...d,
        store: d.store.trim(),
        title: d.title.trim(),
        items: d.items.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim() })),
        balance: d.kind === 'purchase' ? null : (d.balance ?? d.total),
      };
      await onSave(clean);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-3 pb-[calc(env(safe-area-inset-bottom)+110px)]">
      {heading}
      {imageUrl && (
        <button type="button" onClick={() => setShowPhoto((v) => !v)} className="mb-4 block w-full overflow-hidden rounded-2xl bg-white/5" aria-expanded={showPhoto}>
          <img src={imageUrl} alt="Receipt photo" className={`w-full object-cover object-top transition-all ${showPhoto ? 'max-h-none' : 'max-h-40'}`} />
          <span className="block py-2 text-center text-[13px] text-white/55">{showPhoto ? 'Show less' : 'Show the whole receipt'}</span>
        </button>
      )}

      <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3" role="radiogroup" aria-label="Type">
        {(['purchase', 'coupon', 'giftcard', 'credit'] as CardKind[]).map((k) => (
          <Chip key={k} active={d.kind === k} onClick={() => update({ kind: k, balance: k === 'purchase' ? null : (d.balance ?? d.total) })}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </div>

      <Section>
        <Field label="Store" unsure={isUnsure('store')}>
          <TextInput value={d.store} list="known-stores" autoComplete="off" placeholder="Where from?" onChange={(e) => update({ store: e.target.value }, 'store')} />
          <datalist id="known-stores">
            {STORES.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </Field>
        <Field label={isPurchase ? 'What is it?' : 'Name'}>
          <TextInput
            value={d.title}
            placeholder={isPurchase ? 'e.g. Boots (optional)' : `e.g. ${d.kind === 'coupon' ? '$10 off $50' : KIND_LABEL[d.kind]}`}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
        <Field label={isPurchase ? 'Purchase date' : 'Issued'} unsure={isUnsure('date')}>
          <DateInput label={isPurchase ? 'Purchase date' : 'Issued'} value={d.date} onChange={(v) => v && update({ date: v }, 'date')} />
        </Field>
        {isPurchase ? (
          <Field label="Total" unsure={isUnsure('total')}>
            <MoneyInput label="Total" value={d.total} onChange={(v) => update({ total: v }, 'total')} />
          </Field>
        ) : (
          <>
            <Field label={d.kind === 'coupon' ? 'Worth' : 'Balance'}>
              <MoneyInput label={d.kind === 'coupon' ? 'Worth' : 'Balance'} value={d.balance ?? d.total} onChange={(v) => update({ balance: v, total: d.total ?? v })} />
            </Field>
            <Field label="Expires" unsure={isUnsure('expires')} hint={!d.expires ? 'Leave empty if it never expires.' : undefined}>
              <DateInput label="Expires" optional value={d.expires} onChange={(v) => update({ expires: v }, 'expires')} />
            </Field>
            <Field label="Code or card number">
              <TextInput value={d.code} autoComplete="off" autoCapitalize="characters" placeholder="Optional" onChange={(e) => update({ code: e.target.value })} />
            </Field>
          </>
        )}
      </Section>

      {isPurchase && (
        <>
          <Section title="Deadlines">
            <Toggle label="Bought online" hint="Return clocks usually start at delivery" checked={d.online} onChange={(v) => update({ online: v })} />
            {d.online && (
              <Field label="Delivered (or arriving)" unsure={ret?.needsDelivery} hint={ret?.needsDelivery ? 'Add the delivery date so the return window starts at the right time.' : undefined}>
                <DateInput label="Delivery date" optional value={d.deliveryDate} onChange={(v) => update({ deliveryDate: v })} />
              </Field>
            )}
            <Field
              label="Return by"
              hint={<Suggestion text={ret?.reason ?? ''} show={fixed.includes('returnBy') && ret?.date !== d.returnBy} onUse={() => unfix('returnBy')} />}
            >
              <DateInput label="Return by" optional value={d.returnBy} onChange={(v) => setFixedDate('returnBy', v)} />
            </Field>
            <Field label="Category">
              <select
                value={d.category}
                onChange={(e) => update({ category: e.target.value as CategoryId })}
                className="mt-0.5 block min-h-[40px] w-full appearance-none bg-transparent text-[17px] text-white focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-ink-800">
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Warranty until"
              hint={<Suggestion text={war?.reason ?? ''} show={fixed.includes('warrantyUntil') && war?.date !== d.warrantyUntil} onUse={() => unfix('warrantyUntil')} />}
            >
              <DateInput label="Warranty until" optional value={d.warrantyUntil} onChange={(v) => setFixedDate('warrantyUntil', v)} />
            </Field>
            <Field label="Extended warranty until" hint="From a protection plan or credit card, if you have one.">
              <DateInput label="Extended warranty until" optional value={d.extendedWarrantyUntil} onChange={(v) => setD({ ...d, extendedWarrantyUntil: v })} />
            </Field>
          </Section>

          <Section title={`Items${d.items.length ? ` (${d.items.length})` : ''}`}>
            {isUnsure('items') && <p className="bg-warn/10 px-4 py-2 text-[13px] text-white/70">No items were read. Add the ones worth remembering, or skip this.</p>}
            {d.items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-1.5">
                <TextInput aria-label={`Item ${i + 1}`} value={it.name} placeholder="Item" onChange={(e) => setItem(i, { name: e.target.value })} className="flex-1" />
                <span className="w-24">
                  <MoneyInput label={`Item ${i + 1} price`} value={it.price} onChange={(v) => setItem(i, { price: v })} placeholder="Price" />
                </span>
                <button
                  type="button"
                  aria-label={`Remove item ${i + 1}`}
                  className="flex h-10 w-10 items-center justify-center text-white/45"
                  onClick={() => update({ items: d.items.filter((_, j) => j !== i) }, 'items')}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            ))}
            <button type="button" className="flex min-h-[48px] w-full items-center gap-2 px-4 text-[15px] text-accent" onClick={() => update({ items: [...d.items, { name: '', price: null }] }, 'items')}>
              <Icon name="plus" size={18} /> Add item
            </button>
          </Section>
        </>
      )}

      <Section title="Notes">
        {isPurchase && (
          <>
            <Field label="Serial number">
              <TextInput value={d.serial} autoComplete="off" autoCapitalize="characters" placeholder="Optional" onChange={(e) => setD({ ...d, serial: e.target.value })} />
            </Field>
            <Field label="Gift for">
              <TextInput value={d.giftFor} placeholder="Optional" onChange={(e) => setD({ ...d, giftFor: e.target.value })} />
            </Field>
            <Field label="Where’s the box?">
              <TextInput value={d.location} placeholder="e.g. Garage shelf" onChange={(e) => setD({ ...d, location: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Notes">
          <textarea
            value={d.notes}
            rows={2}
            placeholder={isPurchase ? 'Size, color, anything else' : 'Conditions, minimum spend…'}
            onChange={(e) => setD({ ...d, notes: e.target.value })}
            className="mt-0.5 block w-full resize-none bg-transparent text-[17px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!valid || saving} className="flex-[2]">
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

