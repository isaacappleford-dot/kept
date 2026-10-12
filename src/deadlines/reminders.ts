import { REMINDER_LEADS } from '../config/policies';
import { KIND_LABEL } from '../data/types';
import { relativeDay, type ISODate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import type { Deadline } from './deadlines';

export interface Reminder {
  /** Unique per deadline and stage, so each reminder fires once. */
  key: string;
  title: string;
  body: string;
  deadline: Deadline;
}

/** The reminder stage a deadline is in: the smallest lead that has been reached, or null. */
export function stageFor(d: Deadline): number | null {
  // Refund checks stay due until answered: an overdue one still gets its (single) reminder.
  if (d.kind === 'refund') return d.daysLeft <= 0 ? 0 : null;
  if (d.daysLeft < 0) return null;
  const leads = [...REMINDER_LEADS[d.kind]].sort((a, b) => a - b);
  for (const lead of leads) if (d.daysLeft <= lead) return lead;
  return null;
}

/** Reminders that are due and haven't fired yet. */
export function dueReminders(list: Deadline[], fired: ReadonlySet<string>, today: ISODate, currency = 'USD'): Reminder[] {
  const out: Reminder[] = [];
  for (const d of list) {
    const stage = stageFor(d);
    if (stage === null) continue;
    const key = `${d.cardId}:${d.kind}:${d.date}:${stage}`;
    if (fired.has(key)) continue;
    out.push({ key, ...reminderText(d, today, currency), deadline: d });
  }
  return out;
}

export function reminderText(d: Deadline, today: ISODate, currency = 'USD'): { title: string; body: string } {
  const money = d.amount ? formatMoney(d.amount, currency, { whole: true }) : '';
  const what = d.name.toLowerCase() === d.store.toLowerCase() || !d.name ? `your ${d.store || 'purchase'}` : `the ${d.name}`;
  const left = d.daysLeft === 0 ? 'Last day' : `${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'} left`;
  switch (d.kind) {
    case 'return': {
      if (d.card.returnStatus === 'returning') {
        const how = d.card.returnMethod === 'mail' ? `drop off ${what}` : `take ${what} back${d.store ? ` to ${d.store}` : ''}`;
        return {
          title: `${left} to ${how}${money ? ` (${money})` : ''}`,
          body: d.card.returnMethod === 'mail' ? 'Your return label is saved in Kept.' : `The return window ends ${relativeDay(d.date, today)}.`,
        };
      }
      return {
        title: `${left} to return ${what}${money ? ` (${money})` : ''}`,
        body: d.store ? `Return window at ${d.store} ends ${relativeDay(d.date, today)}.` : `Return window ends ${relativeDay(d.date, today)}.`,
      };
    }
    case 'warranty': {
      const when = d.daysLeft === 0 ? 'today' : `in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`;
      return { title: `Your ${d.name} warranty ends ${when}`, body: 'Anything acting up? Now’s the time to claim.' };
    }
    case 'price': {
      const store = d.store || 'the store';
      return {
        title: d.daysLeft === 0 ? `Last day for a price-drop refund on ${what}` : `Did ${what} get cheaper at ${store}?`,
        body: `${store} usually refunds the difference until ${relativeDay(d.date, today)}. Worth a quick look.`,
      };
    }
    case 'refund':
      return {
        title: `Did your ${money ? `${money} ` : ''}refund for ${what} arrive?`,
        body: 'Check your card or account, then tap to mark it.',
      };
    case 'charge': {
      const trial = /\btrial\b/i.test(d.card.title);
      const name = d.name || 'subscription';
      return {
        title: `Your ${name} ${trial ? 'ends' : 'renews'} ${relativeDay(d.date, today)}${money ? ` (${money})` : ''}`,
        body: trial ? 'Cancel before then if you don’t want to be charged.' : 'Still want it? Cancel before then if not.',
      };
    }
    case 'expires': {
      const label = KIND_LABEL[d.card.kind].toLowerCase();
      const amount = money ? `${money} ` : '';
      return {
        title: `Your ${amount}${label}${d.store ? ` at ${d.store}` : ''} expires ${relativeDay(d.date, today)}`,
        body: d.card.kind === 'coupon' ? 'Use it or lose it.' : 'Spend it before it’s gone.',
      };
    }
  }
}
