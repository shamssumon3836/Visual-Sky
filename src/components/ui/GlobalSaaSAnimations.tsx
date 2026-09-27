import React, { useEffect, useState, useCallback } from 'react';

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  color: 'cyan' | 'pink' | 'amber' | 'purple';
  isInteractive: boolean;
}

export const GlobalSaaSAnimations: React.FC = () => {
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; active: boolean }>({
    x: -500,
    y: -500,
    active: false,
  });

  const handlePointerDown = useCallback((e: PointerEvent) => {
    // Ignore right-clicks
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    const interactiveEl = target?.closest('button, a, [role="button"], input, select, textarea, .saas-interactive');
    const textContent = (interactiveEl?.textContent || '').toLowerCase();

    let color: 'cyan' | 'pink' | 'amber' | 'purple' = 'cyan';
    if (
      textContent.includes('bkash') ||
      textContent.includes('বিকাশ') ||
      interactiveEl?.className?.toString().includes('E2136E') ||
      interactiveEl?.className?.toString().includes('pink')
    ) {
      color = 'pink';
    } else if (
      textContent.includes('agency') ||
      interactiveEl?.className?.toString().includes('amber')
    ) {
      color = 'amber';
    } else if (
      textContent.includes('ai') ||
      textContent.includes('miner') ||
      interactiveEl?.className?.toString().includes('purple')
    ) {
      color = 'purple';
    }

    const newRipple: ClickRipple = {
      id: Date.now() + Math.random(),
      x: e.clientX,
      y: e.clientY,
      color,
      isInteractive: Boolean(interactiveEl),
    };

    setRipples((prev) => [...prev.slice(-7), newRipple]);

    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        setMousePos({ x: e.clientX, y: e.clientY, active: true });
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [handlePointerDown]);

  const getColorStyles = (color: ClickRipple['color']) => {
    switch (color) {
      case 'pink':
        return {
          ring: 'border-[#f43f8e]',
          glow: 'bg-[#E2136E]/35',
          dot: 'bg-[#f43f8e]',
        };
      case 'amber':
        return {
          ring: 'border-amber-400',
          glow: 'bg-amber-400/35',
          dot: 'bg-amber-300',
        };
      case 'purple':
        return {
          ring: 'border-purple-400',
          glow: 'bg-purple-500/35',
          dot: 'bg-purple-300',
        };
      default:
        return {
          ring: 'border-cyan-400',
          glow: 'bg-cyan-400/35',
          dot: 'bg-cyan-300',
        };
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden select-none" aria-hidden="true">
      {/* Subtle Ambient Mouse Spotlight on Desktop */}
      {mousePos.active && (
        <div
          className="hidden md:block fixed w-[380px] h-[380px] rounded-full pointer-events-none transition-transform duration-75 ease-out"
          style={{
            left: `${mousePos.x - 190}px`,
            top: `${mousePos.y - 190}px`,
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.055) 0%, rgba(59, 130, 246, 0.025) 45%, transparent 70%)',
          }}
        />
      )}

      {/* Global Click Tactile Burst & Ripple Rings */}
      {ripples.map((ripple) => {
        const styles = getColorStyles(ripple.color);
        const particleAngles = [0, 60, 120, 180, 240, 300];

        return (
          <div
            key={ripple.id}
            className="fixed pointer-events-none"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
            }}
          >
            {/* Core Flash Dot */}
            <span
              className={`block absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${styles.glow} saas-click-core`}
            />

            {/* Primary Expanding Precision Ring */}
            <span
              className={`block absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${styles.ring} saas-click-ring`}
            />

            {/* Secondary Outer Shockwave Ring for Interactive Elements */}
            {ripple.isInteractive && (
              <span
                className={`block absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${styles.ring} opacity-60 saas-click-ring-outer`}
              />
            )}

            {/* 6 Micro-Spark Particles */}
            {particleAngles.map((angle) => (
              <span
                key={angle}
                className="block absolute left-0 top-0"
                style={{
                  transform: `rotate(${angle}deg)`,
                }}
              >
                <span
                  className={`block w-1 h-1 rounded-full ${styles.dot} saas-click-spark`}
                />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};
