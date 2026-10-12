import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { CardRow } from '../components/Rows';
import { TabBar } from '../components/TabBar';
import { Button, Chip, EmptyState, Header, IconButton, Sheet, SheetItem, Spinner } from '../components/ui';
import { useCards } from '../data/hooks';
import { searchCards, type Filter } from '../data/search';
import { shareInventory } from '../export/actions';
import { todayISO } from '../lib/dates';
import { navigate } from '../lib/router';
import { useSettings } from '../settings';

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['returnable', 'Can return'],
  ['purchases', 'Purchases'],
  ['wallet', 'Wallet'],
  ['returned', 'Returned'],
];

export default function ReceiptsScreen() {
  const cards = useCards();
  const { currency } = useSettings();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [menu, setMenu] = useState(false);
  const results = useMemo(() => (cards ? searchCards(cards, q, filter, todayISO()) : []), [cards, q, filter]);

  return (
    <div className="min-h-screen-safe bg-ink pb-tabs">
      <Header large title="Receipts" right={<IconButton icon="download" label="Export" onClick={() => setMenu(true)} className="bg-transparent" />} />
      <div className="mx-auto max-w-lg">
        <div className="sticky top-[calc(env(safe-area-inset-top)+60px)] z-10 bg-ink/95 px-3 pb-3 backdrop-blur">
          <label className="flex items-center gap-2 rounded-xl bg-white/10 px-3">
            <Icon name="search" size={18} className="text-white/50" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search “TV” or “Best Buy”"
              aria-label="Search receipts"
              className="min-h-[44px] flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
            />
          </label>
          <div className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3" role="radiogroup" aria-label="Filter">
            {FILTERS.map(([id, label]) => (
              <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {cards === undefined && (
          <div className="flex justify-center py-20">
            <Spinner label="Loading" />
          </div>
        )}
        {cards && results.length > 0 && (
          <ul className="mx-3 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5" aria-label={`${results.length} result${results.length === 1 ? '' : 's'}`}>
            {results.map((c) => (
              <CardRow key={c.id} card={c} />
            ))}
          </ul>
        )}
        {cards && results.length === 0 && (
          <EmptyState icon={cards.length ? 'search' : 'receipt'} title={cards.length ? 'No matches' : 'No receipts yet'}>
            <p className="text-[15px] text-white/60">{cards.length ? 'Try a store, an item or part of a serial number.' : 'Every receipt you scan is kept here, searchable.'}</p>
            {!cards.length && (
              <Button className="mt-2" onClick={() => navigate({ name: 'scan' })}>
                Scan a receipt
              </Button>
            )}
          </EmptyState>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Export">
        <SheetItem
          icon="file"
          label="Everything I own (PDF)"
          hint="Items with prices and serial numbers, for insurance claims"
          onClick={() => {
            setMenu(false);
            void shareInventory(cards ?? [], currency, 'pdf');
          }}
        />
        <SheetItem
          icon="download"
          label="Everything I own (spreadsheet)"
          hint="CSV for Numbers, Excel or Google Sheets"
          onClick={() => {
            setMenu(false);
            void shareInventory(cards ?? [], currency, 'csv');
          }}
        />
      </Sheet>
      <TabBar current="receipts" />
    </div>
  );
}
