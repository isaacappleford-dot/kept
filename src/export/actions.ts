import { APP } from '../config/app';
import type { Card } from '../data/types';
import type { Deadline } from '../deadlines/deadlines';
import { todayISO } from '../lib/dates';
import { toast } from '../lib/toast';
import { inventoryCSV } from './csv';
import { inventoryPdf, receiptPdf } from './documents';
import { buildICS } from './ics';
import { download, shareOrDownload } from './share';

function report(outcome: Awaited<ReturnType<typeof shareOrDownload>>, done: string) {
  if (outcome === 'shared' || outcome === 'downloaded') toast(done);
  else if (outcome === 'needs-gesture') toast('Tap again to share');
  else if (outcome === 'failed') toast('Couldn’t export. Try again.');
}

/** Hands deadlines to the phone's calendar app (iPhone opens "Add to Calendar"). */
export async function addToCalendar(list: Deadline[], currency: string, name = 'deadlines') {
  const upcoming = list.filter((d) => d.daysLeft >= 0);
  if (!upcoming.length) return toast('Nothing upcoming to add');
  const ics = buildICS(upcoming, todayISO(), new Date(), currency);
  const file = new File([ics], `${APP.filePrefix}-${name}.ics`, { type: 'text/calendar' });
  // Opening the .ics directly is what triggers the calendar import on iPhone and Android.
  if (download(file)) toast(upcoming.length === 1 ? 'Opening Calendar…' : `Adding ${upcoming.length} deadlines to Calendar…`);
  else toast('Couldn’t open Calendar');
}

export async function shareReceiptPdf(card: Card, currency: string) {
  const file = await receiptPdf(card, currency);
  report(await shareOrDownload(file), 'PDF ready');
}

export async function shareInventory(cards: Card[], currency: string, format: 'pdf' | 'csv') {
  const file =
    format === 'pdf'
      ? inventoryPdf(cards, currency)
      : new File([inventoryCSV(cards)], `${APP.filePrefix}-inventory-${todayISO()}.csv`, { type: 'text/csv' });
  report(await shareOrDownload(file), 'Inventory exported');
}
