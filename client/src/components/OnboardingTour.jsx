import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getRectForTarget = (targetSelector) => {
  if (!targetSelector) return null;
  const el = document.querySelector(targetSelector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return rect;
};

export function OnboardingTour({
  isOpen,
  steps,
  stepIndex,
  canNext = true,
  nextDisabledReason = '',
  onBack,
  onNext,
  onSkip,
}) {
  const step = steps?.[stepIndex] || null;
  const [rect, setRect] = useState(null);

  const targetSelector = step?.target || null;

  useEffect(() => {
    if (!isOpen) return;
    const update = () => setRect(getRectForTarget(targetSelector));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, targetSelector, stepIndex]);

  useEffect(() => {
    if (!isOpen) return;
    if (!targetSelector) return;
    const el = document.querySelector(targetSelector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isOpen, targetSelector, stepIndex]);

  const spotlightStyle = useMemo(() => {
    if (!rect) return null;
    const padding = 8;
    const top = rect.top - padding;
    const left = rect.left - padding;
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;
    return {
      top,
      left,
      width,
      height,
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
    };
  }, [rect]);

  const popoverStyle = useMemo(() => {
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const width = 360;
    const margin = 14;
    const navRect = getRectForTarget('[data-tour="nav-views"]');
    const minTop = navRect ? navRect.bottom + 12 : margin;
    const forceTopRight = stepIndex === 5 || stepIndex === 6;

    if (forceTopRight) {
      return {
        top: clamp(minTop, margin, vh - margin - 220),
        left: clamp(vw - margin - width, margin, vw - margin - width),
        width,
      };
    }

    if (!rect) {
      return {
        top: clamp(Math.max(vh * 0.25, minTop), margin, vh - margin - 200),
        left: clamp(vw * 0.5 - width / 2, margin, vw - margin - width),
        width,
      };
    }

    const preferredTop = rect.bottom + 12;
    const fallbackTop = rect.top - 12 - 220;
    let top = preferredTop + 220 < vh
      ? preferredTop
      : clamp(fallbackTop, margin, vh - margin - 220);
    top = clamp(Math.max(top, minTop), margin, vh - margin - 220);

    const left = clamp(rect.left, margin, vw - margin - width);
    return { top, left, width };
  }, [rect, stepIndex]);

  if (!isOpen || !step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {spotlightStyle && (
        <div
          className="absolute rounded-xl border border-white/30 pointer-events-none"
          style={spotlightStyle}
        />
      )}
      <div
        className="absolute rounded-xl border border-white/20 bg-slate-900/95 text-white shadow-2xl p-4 pointer-events-auto"
        style={popoverStyle}
      >
        <div className="text-xs uppercase tracking-wide text-purple-200">
          Step {stepIndex + 1} of {steps.length}
        </div>
        <div className="mt-1 text-lg font-semibold">{step.title}</div>
        <div className="mt-2 text-sm text-purple-100 whitespace-pre-line">
          {step.content}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-purple-100 hover:bg-white/10 transition"
          >
            Skip
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="text-xs px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-40 transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="text-xs px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
            >
              {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
        {!canNext && nextDisabledReason ? (
          <div className="mt-2 text-xs text-yellow-200">
            {nextDisabledReason}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
