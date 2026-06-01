import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { handleModalKeyDown } from '../lib/focus';

interface BreakthroughOverlayProps {
  resourceTitle: string;
  stageName: string;
  onClose: () => void;
}

function stableUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * (salt + 23.23)) * 10000;
  return value - Math.floor(value);
}

export function BreakthroughOverlay({ resourceTitle, stageName, onClose }: BreakthroughOverlayProps) {
  const [lightningVisible, setLightningVisible] = useState(true);
  const [lightningKey, setLightningKey] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Generate 12 falling runic talismans with stable speeds and positions.
  const talismans = useMemo(() => {
    const characters = ['道', '炁', '乾', '坤', '法', '玄', '妙', '丹', '仙', '真', '太', '极'];
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      char: characters[i % characters.length],
      left: `${5 + stableUnit(i, 1) * 90}%`,
      delay: `${stableUnit(i, 2) * 5}s`,
      duration: `${6 + stableUnit(i, 3) * 5}s`,
      scale: 0.75 + stableUnit(i, 4) * 0.4,
    }));
  }, []);

  // Rapid lightning flashes at the beginning
  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const flashInterval = setInterval(() => {
      setLightningKey((k) => k + 1);
      setLightningVisible(true);
      setTimeout(() => setLightningVisible(false), 80);
    }, 280);

    const stopTimeout = setTimeout(() => {
      clearInterval(flashInterval);
      setLightningVisible(false);
    }, 1500);

    return () => {
      clearInterval(flashInterval);
      clearTimeout(stopTimeout);
    };
  }, []);

  const handleConsolidate = () => {
    setFadingOut(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getLightningPath = () => {
    const paths = [
      "M 100 0 L 120 180 L 70 280 L 140 420 L 90 600 L 160 800",
      "M 700 0 L 650 200 L 710 350 L 640 500 L 700 680 L 660 900",
      "M 300 0 L 340 150 L 290 300 L 370 450 L 310 600 L 350 900",
      "M 900 0 L 840 220 L 890 400 L 810 580 L 870 720 L 830 900"
    ];
    return paths[lightningKey % paths.length];
  };

  return (
    <div
      className={`breakthrough-overlay ${fadingOut ? 'opacity-0 scale-95 pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakthrough-title"
      onKeyDown={(event) => handleModalKeyDown(event, handleConsolidate)}
      style={{
        transition: 'all 320ms cubic-bezier(0.19, 1, 0.22, 1)',
        isolation: 'isolate'
      }}
    >
      {/* 1. Lightning Discharge Effect */}
      {lightningVisible && (
        <svg className="breakthrough-lightning-svg" viewBox="0 0 1000 900" xmlns="http://www.w3.org/2000/svg">
          <path
            key={lightningKey}
            className="breakthrough-lightning-path"
            d={getLightningPath()}
            strokeWidth="4"
          />
          <path
            key={lightningKey + 10}
            className="breakthrough-lightning-path"
            d={getLightningPath().replace(/([0-9]+)/g, (m) => String(Number(m) + 30))}
            strokeWidth="2"
            opacity="0.7"
          />
        </svg>
      )}

      {/* 2. Conic Shimmering Rays in background */}
      <div className="breakthrough-rays" />

      {/* 3. Falling Golden Runic Talismans */}
      {talismans.map((t) => (
        <div
          key={t.id}
          className="breakthrough-talisman"
          style={{
            left: t.left,
            animationDelay: t.delay,
            animationDuration: t.duration,
            transform: `scale(${t.scale})`,
          }}
        >
          {t.char}
        </div>
      ))}

      {/* 4. Glowing Center Ring & Double-Rotating Array */}
      <div className="breakthrough-glow-ring">
        <div className="breakthrough-avatar-wrap">
          <svg
            className="breakthrough-core-avatar"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer rotating ring (clockwise) */}
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="10 4"
              style={{
                transformOrigin: 'center center',
                animation: 'rotate-spiritual-array 18s linear infinite'
              }}
            />
            {/* Inner counter-rotating ring (counter-clockwise) */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="6 3"
              style={{
                transformOrigin: 'center center',
                animation: 'rotate-spiritual-array 12s linear infinite reverse'
              }}
            />
            {/* Concentric circle boundaries */}
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.4" />

            {/* Taiji Yin-Yang core */}
            <path
              d="M50,15 A17.5,17.5 0 0,0 50,50 A17.5,17.5 0 0,1 50,85 A35,35 0 0,1 50,15 Z"
              fill="currentColor"
            />
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" />

            {/* Core polar dots */}
            <circle cx="50" cy="32.5" r="3.5" fill="var(--bg, #0b0e0f)" />
            <circle cx="50" cy="67.5" r="3.5" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* 5. Glitch Ceremony Texts */}
      <h1 id="breakthrough-title" className="breakthrough-ink-text">功法大成</h1>
      <p className="breakthrough-sub-text">
        恭喜道友，成功参悟秘卷：<span className="text-gradient-themed" style={{ fontWeight: 'bold' }}>{resourceTitle}</span>
      </p>

      <div
        className="text-gradient-themed"
        style={{
          marginTop: '18px',
          padding: '8px 20px',
          border: '1.5px solid var(--accent-strong)',
          borderRadius: '6px',
          background: 'rgba(0,0,0,0.4)',
          fontSize: '15px',
          fontWeight: 'bold',
          letterSpacing: '2px',
          zIndex: 3,
          boxShadow: '0 0 15px rgb(var(--accent-strong-rgb) / 0.35)',
          animation: 'ink-fade-in 1.6s cubic-bezier(0.19, 1, 0.22, 1) 0.4s forwards',
          opacity: 0
        }}
      >
        当前道行境界：{stageName}
      </div>

      {/* 6. Consolidate Button */}
      <button
        ref={confirmButtonRef}
        className="primary-button breakthrough-btn"
        type="button"
        onClick={handleConsolidate}
        aria-label="巩固境界并关闭突破提示"
        style={{
          background: 'var(--accent-gradient)',
          border: 'none',
          color: 'var(--on-accent, #110e08)'
        }}
      >
        <Sparkles size={16} />
        巩固境界 (出关)
      </button>
    </div>
  );
}
