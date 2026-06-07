import type { CSSProperties, ReactNode } from 'react';

import type { AppTab } from './types';

type ParticleStyle = CSSProperties & {
  '--drift-x': string;
};

type AppBackgroundProps = {
  activeTab: AppTab;
  animPaused: boolean;
  stageClass: string;
  children: ReactNode;
};

function stableUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * (salt + 19.19)) * 10000;
  return value - Math.floor(value);
}

export function AppBackground({ activeTab, animPaused, stageClass, children }: AppBackgroundProps) {
  const shellThemeClass = activeTab === 'meditation' ? stageClass : `tab-theme-${activeTab}`;
  const colorsMap: Record<AppTab, string[]> = {
    meditation: [
      'var(--accent-strong)',
      'rgba(98, 195, 158, 0.75)',
      'rgba(230, 185, 93, 0.75)',
      'rgba(177, 159, 251, 0.75)',
      'rgba(93, 164, 230, 0.75)',
    ],
    library: [
      'rgba(230, 185, 93, 0.8)',
      'rgba(217, 143, 36, 0.75)',
      'rgba(255, 231, 163, 0.9)',
      'rgba(166, 158, 141, 0.6)',
    ],
    analytics: [
      'rgba(224, 245, 255, 0.85)',
      'rgba(157, 232, 255, 0.75)',
      'rgba(116, 128, 255, 0.7)',
      'rgba(215, 194, 255, 0.65)',
    ],
    spirit: [
      'rgba(215, 194, 255, 0.85)',
      'rgba(255, 180, 226, 0.8)',
      'rgba(255, 211, 107, 0.75)',
      'rgba(155, 120, 241, 0.7)',
    ],
  };
  const colors = colorsMap[activeTab] ?? colorsMap.meditation;
  const particles = Array.from({ length: 5 }).map((_, i) => ({
    id: i,
    left: `${stableUnit(i, 1) * 95}%`,
    delay: `${stableUnit(i, 2) * 8}s`,
    duration: `${6 + stableUnit(i, 3) * 6}s`,
    size: `${3 + stableUnit(i, 4) * 4}px`,
    driftX: `${-65 + stableUnit(i, 5) * 130}px`,
    color: colors[i % colors.length],
  }));

  return (
    <main className={`app-shell ${shellThemeClass}`} data-anim-paused={animPaused}>
      <div className="spiritual-array-bg" aria-hidden="true">
        <BackgroundGlyph activeTab={activeTab} />
        {particles.map((p) => {
          const particleStyle: ParticleStyle = {
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            '--drift-x': p.driftX,
            background: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          };

          return <div key={p.id} className="spiritual-particle" style={particleStyle} />;
        })}
      </div>
      {children}
    </main>
  );
}

function BackgroundGlyph({ activeTab }: { activeTab: AppTab }) {
  if (activeTab === 'library') {
    return (
      <svg className="spiritual-array-svg library-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polygon points="100,5 167,33 195,100 167,167 100,195 33,167 5,100 33,33" stroke="currentColor" strokeWidth="0.8" strokeDasharray="5 3" />
        <polygon points="100,15 157,39 181,100 157,161 100,181 43,161 19,100 43,39" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 2" />
        <rect x="80" y="80" width="40" height="40" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.8" />
        <line x1="85" y1="90" x2="115" y2="90" stroke="currentColor" strokeWidth="0.8" />
        <line x1="85" y1="100" x2="115" y2="100" stroke="currentColor" strokeWidth="0.8" />
        <line x1="85" y1="110" x2="105" y2="110" stroke="currentColor" strokeWidth="0.8" />
        <path d="M40 40 L60 60 M160 40 L140 60 M40 160 L60 140 M160 160 L140 140" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
      </svg>
    );
  }
  if (activeTab === 'analytics') {
    return (
      <svg className="spiritual-array-svg analytics-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
        <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="0.8" strokeDasharray="10 5" />
        <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="0.4" />
        <circle cx="100" cy="100" r="25" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" />
        <path d="M100 5 L159 181 L5 73 L195 73 L41 181 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
        <circle cx="100" cy="5" r="2.5" fill="currentColor" />
        <circle cx="159" cy="181" r="2.5" fill="currentColor" />
        <circle cx="5" cy="73" r="2.5" fill="currentColor" />
        <circle cx="195" cy="73" r="2.5" fill="currentColor" />
        <circle cx="41" cy="181" r="2.5" fill="currentColor" />
        <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 3" />
      </svg>
    );
  }
  if (activeTab === 'spirit') {
    return (
      <svg className="spiritual-array-svg spirit-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
        <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 3" />
        <path d="M100 20 C120 50, 120 70, 100 100 C80 70, 80 50, 100 20 Z" stroke="currentColor" strokeWidth="0.8" />
        <path d="M100 180 C120 150, 120 130, 100 100 C80 130, 80 150, 100 180 Z" stroke="currentColor" strokeWidth="0.8" />
        <path d="M20 100 C50 120, 70 120, 100 100 C70 80, 50 80, 20 100 Z" stroke="currentColor" strokeWidth="0.8" />
        <path d="M180 100 C150 120, 130 120, 100 100 C130 80, 150 80, 180 100 Z" stroke="currentColor" strokeWidth="0.8" />
        <path d="M43 43 C70 60, 80 70, 100 100 C80 80, 70 60, 43 43 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
        <path d="M157 157 C130 140, 120 130, 100 100 C120 120, 130 140, 157 157 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
        <path d="M43 157 C70 140, 80 130, 100 100 C80 120, 70 140, 43 157 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
        <path d="M157 43 C130 60, 120 70, 100 100 C120 80, 130 60, 157 43 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
        <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="1" />
        <path d="M100 85 C108 93, 108 100, 100 115 C92 100, 92 93, 100 85 Z" fill="currentColor" opacity="0.9" />
      </svg>
    );
  }

  return (
    <svg className="spiritual-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.8" strokeDasharray="8 4" />
      <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.6" />
      <path d="M100 5 L100 195 M5 100 L195 100 M33 33 L167 167 M33 167 L167 33" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
      <circle cx="100" cy="100" r="15" stroke="currentColor" strokeWidth="1" />
      <path d="M100 85 A7.5 7.5 0 0 0 100 100 A7.5 7.5 0 0 1 100 115 A15 15 0 0 1 100 85 Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}
