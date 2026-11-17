'use client';

import { useEffect, useRef } from 'react';
import { useMock } from './mode';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function Lightbox({ images, index, onIndex, onClose }: { images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const mock = useMock();
  const count = images.length;
  const go = (step: number) => onIndex((index + step + count) % count);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const src = images[index];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`图表 ${index + 1} / ${count}`}
      className="fixed inset-0 z-[80] flex flex-col bg-paper/95 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <p className="gr-meta">
          图表 {index + 1} / {count}
          {host(src) && <span className="normal-case tracking-normal"> · {host(src)}</span>}
        </p>
        <button ref={closeButton} type="button" onClick={onClose} className="gr-btn-line">
          关闭
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {mock ? <span className="bg-paper-deep p-10">图表预览</span> : <img key={src} src={src} alt={`来源中的图表 ${index + 1}`} className="gr-in max-h-full max-w-[min(1100px,100%)] object-contain shadow-[0_40px_80px_-50px_rgba(29,25,21,0.6)]" />}
      </div>
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-medium underline decoration-rule underline-offset-4 hover:decoration-rubric">
          打开原图
        </a>
        {count > 1 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} className="gr-btn-line" aria-label="上一张图表">
              上一张
            </button>
            <button type="button" onClick={() => go(1)} className="gr-btn-line" aria-label="下一张图表">
              下一张
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
