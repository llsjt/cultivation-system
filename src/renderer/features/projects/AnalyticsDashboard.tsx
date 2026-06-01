import { BookOpen, Award, Compass, Layers } from 'lucide-react';
import { useMemo } from 'react';

import type { GetHomeOverviewOutput } from '../../../shared/dto';

type AnalyticsDashboardProps = {
  overview: GetHomeOverviewOutput;
};

function formatStudiedAt(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}年${month}月${date}日 ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

export function AnalyticsDashboard({ overview }: AnalyticsDashboardProps) {
  const totalProjects = overview.projects.length;
  const totalResources = overview.projects.reduce((sum, project) => sum + project.resource_count, 0);
  const averageProgress = overview.projects.length
    ? Math.round(overview.projects.reduce((sum, project) => sum + project.progress_percent, 0) / overview.projects.length)
    : 0;
  const totalRecentLogs = overview.recent_logs.length;

  // Calculate Five Elements dynamically based on project titles and progress
  const fiveElements = useMemo(() => {
    let jin = 10;   // Metal (Systems, algorithms, backend, backend development)
    let mu = 10;    // Wood (Languages, books, humanities, reading)
    let shui = 10;  // Water (Frontend, interfaces, design, web development)
    let huo = 10;   // Fire (Logic, review, others)
    let tu = 10;    // Earth (Databases, infrastructure, docker, architecture)

    overview.projects.forEach((p) => {
      const name = p.name.toLowerCase();
      const weight = p.progress_percent || 15;

      if (name.match(/react|next|css|frontend|前端|vite|ui|tailwind|html|js|ts|javascript|typescript|flutter|web/)) {
        shui += weight;
      } else if (name.match(/rust|go|c\+\+|c#|java|backend|后端|算法|algorithm|leetcode|data structure|数据结构|cpp|python|compil/)) {
        jin += weight;
      } else if (name.match(/english|英语|单词|read|book|阅读|人文|哲学|语文|书|lang|vocab|art/)) {
        mu += weight;
      } else if (name.match(/db|database|sql|docker|devops|deploy|部署|architecture|架构|linux|postgres|mysql|sqlite|redis|cloud/)) {
        tu += weight;
      } else {
        huo += weight;
      }
    });

    const maxVal = Math.max(jin, mu, shui, huo, tu, 100);
    return {
      jin: Math.round((jin / maxVal) * 100),
      mu: Math.round((mu / maxVal) * 100),
      shui: Math.round((shui / maxVal) * 100),
      huo: Math.round((huo / maxVal) * 100),
      tu: Math.round((tu / maxVal) * 100),
    };
  }, [overview.projects]);

  // SVG Radar coordinates helper
  const points = useMemo(() => {
    const center = 150;
    const maxRadius = 90;
    const scores = [fiveElements.jin, fiveElements.mu, fiveElements.shui, fiveElements.huo, fiveElements.tu];

    return scores.map((score, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
      const radius = (score / 100) * maxRadius;
      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
      };
    });
  }, [fiveElements]);

  // Polygon string for SVG
  const polygonPointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Standard radar grid coordinates
  const gridPolygons = useMemo(() => {
    const center = 150;
    const maxRadius = 90;
    const steps = [0.2, 0.4, 0.6, 0.8, 1.0];

    return steps.map((step) => {
      const r = step * maxRadius;
      return Array.from({ length: 5 }).map((_, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
        return {
          x: center + r * Math.cos(angle),
          y: center + r * Math.sin(angle),
        };
      });
    });
  }, []);

  const elementLabels = ['【金 · 编程底蕴】', '【木 · 人文语言】', '【水 · 交互艺术】', '【火 · 逻辑思维】', '【土 · 系统架构】'];
  const elementColors = ['#a5f3fc', '#62c39e', '#5da4e6', '#cc4e3d', '#e6b95d'];

  return (
    <div className="analytics-panel">
      {/* 🔮 Overview Cards */}
      <div className="analytics-overview-row">
        <div className="analytics-card" style={{ borderColor: 'rgba(34, 211, 238, 0.3)' }}>
          <span className="val">{totalProjects}</span>
          <span className="label">
            <Compass size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            参悟法门
          </span>
        </div>
        <div className="analytics-card" style={{ borderColor: 'rgba(98, 195, 158, 0.3)' }}>
          <span className="val">{totalResources}</span>
          <span className="label">
            <Layers size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            研读法宝
          </span>
        </div>
        <div className="analytics-card" style={{ borderColor: 'rgba(230, 185, 93, 0.3)' }}>
          <span className="val">{averageProgress}%</span>
          <span className="label">
            <Award size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            总参悟度
          </span>
        </div>
        <div className="analytics-card" style={{ borderColor: 'rgba(204, 78, 61, 0.3)' }}>
          <span className="val">{totalRecentLogs}</span>
          <span className="label">
            <BookOpen size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            历练次数
          </span>
        </div>
      </div>

      {/* Grid Layout: Radar vs Timeline */}
      <div className="analytics-grid">
        {/* Left Column: Radar Chart */}
        <div className="radar-chart-container">
          <h3 style={{ fontFamily: '"InkBrushTitle", serif', color: 'var(--accent-strong)', fontSize: '16px', margin: 0 }}>
            ☯ 元神五行根骨
          </h3>
          <p className="text-xs muted" style={{ margin: '0 0 10px 0', textAlign: 'center' }}>
            根据参悟秘籍的项目类别与深度自动推衍元神根骨
          </p>

          <svg
            width="300"
            height="300"
            viewBox="0 0 300 300"
            role="img"
            aria-labelledby="analytics-radar-title analytics-radar-desc"
            style={{ overflow: 'visible', width: 'min(300px, 100%)', height: 'auto' }}
          >
            <title id="analytics-radar-title">元神五行根骨雷达图</title>
            <desc id="analytics-radar-desc">展示项目名称和进度推算出的金、木、水、火、土五项分布。</desc>
            {/* Grid concentric polygons */}
            {gridPolygons.map((gp, i) => {
              const pointsStr = gp.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <polygon
                  key={i}
                  points={pointsStr}
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="0.8"
                  strokeDasharray={i === 4 ? 'none' : '3 3'}
                  opacity={0.5}
                />
              );
            })}

            {/* Radar axes */}
            {Array.from({ length: 5 }).map((_, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
              const maxRadius = 90;
              const destX = 150 + maxRadius * Math.cos(angle);
              const destY = 150 + maxRadius * Math.sin(angle);
              return (
                <line
                  key={index}
                  x1="150"
                  y1="150"
                  x2={destX}
                  y2={destY}
                  stroke="var(--line)"
                  strokeWidth="0.8"
                  opacity={0.4}
                />
              );
            })}

            {/* Interactive labels */}
            {elementLabels.map((label, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
              const labelRadius = 116;
              const x = 150 + labelRadius * Math.cos(angle);
              const y = 150 + labelRadius * Math.sin(angle);
              return (
                <text
                  key={index}
                  x={x}
                  y={y}
                  fill={elementColors[index]}
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor={Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle'}
                  dominantBaseline="middle"
                  style={{ textShadow: '0 0 4px rgba(0,0,0,0.6)' }}
                >
                  {label}
                </text>
              );
            })}

            {/* Radar values path */}
            <polygon
              points={polygonPointsStr}
              fill="rgba(184, 141, 62, 0.28)"
              stroke="var(--accent-strong)"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 6px rgb(var(--accent-strong-rgb) / 0.5))' }}
            />

            {/* Axis points */}
            {points.map((p, index) => (
              <circle
                key={index}
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill={elementColors[index]}
                stroke="#fff"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }}
              />
            ))}
          </svg>

          {/* Details breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', width: '100%', marginTop: '10px' }}>
            {[
              { k: '金', v: fiveElements.jin, c: elementColors[0] },
              { k: '木', v: fiveElements.mu, c: elementColors[1] },
              { k: '水', v: fiveElements.shui, c: elementColors[2] },
              { k: '火', v: fiveElements.huo, c: elementColors[3] },
              { k: '土', v: fiveElements.tu, c: elementColors[4] },
            ].map((item) => (
              <div
                key={item.k}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '4px',
                  borderRadius: '4px',
                  border: '1px solid var(--line)',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: item.c }}>{item.k}</span>
                <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{item.v}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Timelines */}
        <div className="timeline-container">
          <h3>📜 修仙全量历练印记</h3>
          <div className="analytics-timeline-scroller">
            {overview.recent_logs.map((log) => (
              <div className="analytics-timeline-item" key={log.id}>
                <div className="analytics-timeline-dot" aria-hidden="true" />
                <div className="analytics-timeline-content">
                  <div className="analytics-timeline-header">
                    <strong style={{ color: 'var(--accent-strong)' }}>{log.resource_title_snapshot}</strong>
                    <span>{formatStudiedAt(log.studied_at)}</span>
                  </div>
                  <div className="analytics-timeline-body">
                    <p style={{ margin: 0 }}>
                      进度破关：{log.progress_before_percent}% → {log.progress_after_percent}%
                      {log.duration_minutes ? ` (历时 ${log.duration_minutes} 分钟)` : ''}
                    </p>
                    {log.content && (
                      <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', fontSize: '14px', color: 'var(--text)' }}>
                        心得：“{log.content}”
                      </p>
                    )}
                    {log.next_action && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--success)' }}>
                        下一步大愿：“{log.next_action}”
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {overview.recent_logs.length === 0 ? (
              <p className="empty text-xs py-12 text-center">仙劫未渡，尚无任何参悟历练印记。</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
