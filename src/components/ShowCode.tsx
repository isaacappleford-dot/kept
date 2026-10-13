import { useEffect, useMemo } from 'react';
import { Button } from './ui';

/**
 * Full screen, white, for a cashier or a drop-off scanner: a saved picture
 * (return QR code, coupon) and/or a code in big letters. Turn your screen
 * brightness up for scanning.
 */
export function ShowCode({ title, image, code, onClose }: { title: string; image?: Blob | null; code?: string; onClose: () => void }) {
  const url = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white text-ink" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex-1 overflow-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <p className="text-center text-[15px] font-semibold text-ink/60">{title}</p>
        {url && <img src={url} alt={title} className="mx-auto mt-3 max-h-[60dvh] w-full max-w-md object-contain" />}
        {code && (
          <p className="mt-6 break-all text-center font-mono text-[34px] font-bold leading-tight tracking-wider" aria-label={`Code ${code}`}>
            {code}
          </p>
        )}
        <p className="mt-4 text-center text-[13px] text-ink/50">Turn your screen brightness up if it won’t scan.</p>
      </div>
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <Button className="w-full !bg-ink !text-white" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
