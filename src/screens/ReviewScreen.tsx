import { useEffect, useMemo } from 'react';
import { CardForm } from '../components/CardForm';
import { Header } from '../components/ui';
import { addCard } from '../data/db';
import { draftStore, useDraft } from '../data/draft';
import { checkReminders } from '../deadlines/notify';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';

const HEADINGS = {
  scan: 'Check these details',
  pdf: 'Check these details',
  paste: 'Check these details',
  sample: 'Check these details',
  quick: 'Check these details',
  manual: 'New card',
};

/** "Check these details" after a scan, PDF, quick add or manual entry. */
export default function ReviewScreen() {
  const { draft, image, unsure, source, fixed, returnNote } = useDraft();
  const imageUrl = useMemo(() => (image ? URL.createObjectURL(image.image) : null), [image]);
  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl]);

  useEffect(() => {
    if (!draft) navigate({ name: 'scan' }, { replace: true });
  }, [draft]);
  if (!draft) return null;

  const read = source !== 'manual' && source !== 'quick';
  return (
    <div className="min-h-screen-safe bg-ink">
      <Header title={HEADINGS[source]} onBack={() => back({ name: 'scan' })} />
      <CardForm
        key={`${draft.date}-${draft.store}-${draft.kind}-${source}`}
        initial={draft}
        unsure={unsure}
        fixed={fixed}
        imageUrl={imageUrl}
        returnNote={returnNote}
        heading={
          read || source === 'quick' ? (
            <p className="mb-4 px-1 text-[14px] text-white/60">
              {unsure.length
                ? 'Most of it is filled in. Fix anything marked “Check”, then save.'
                : 'Everything was read. Give it a quick look, then save.'}{' '}
              Dates are suggestions: confirm them against the receipt.
            </p>
          ) : null
        }
        saveLabel="Save"
        onCancel={() => {
          draftStore.set({ draft: null, image: null });
          navigate({ name: 'home' }, { replace: true });
        }}
        onSave={async (d) => {
          const card = await addCard(d, image);
          draftStore.set({ draft: null, image: null });
          toast('Saved. We’ll remind you.');
          void checkReminders();
          navigate({ name: 'card', id: card.id }, { replace: true });
        }}
      />
    </div>
  );
}
