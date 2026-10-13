import { CardForm } from '../components/CardForm';
import { Header, Spinner } from '../components/ui';
import { updateCard } from '../data/db';
import { useCard, useImageUrl } from '../data/hooks';
import { checkReminders } from '../deadlines/notify';
import { back } from '../lib/router';
import { toast } from '../lib/toast';

export default function EditScreen({ id }: { id: string }) {
  const card = useCard(id);
  const imageUrl = useImageUrl(card?.hasImage ? id : null, 'image');
  return (
    <div className="min-h-screen-safe bg-ink">
      <Header title="Edit" onBack={() => back({ name: 'card', id })} />
      {card === undefined && (
        <div className="flex justify-center py-20">
          <Spinner label="Loading" />
        </div>
      )}
      {card === null && <p className="p-8 text-center text-white/60">This card was deleted.</p>}
      {card && (
        <CardForm
          initial={card}
          // Saved dates stay as they are when editing; the user changes them by hand.
          fixed={['returnBy', 'warrantyUntil', 'extendedWarrantyUntil']}
          imageUrl={imageUrl}
          saveLabel="Save changes"
          onCancel={() => back({ name: 'card', id })}
          onSave={async (d) => {
            await updateCard(id, d);
            toast('Saved');
            void checkReminders();
            back({ name: 'card', id });
          }}
        />
      )}
    </div>
  );
}
