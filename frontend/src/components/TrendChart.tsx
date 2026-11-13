type Point = { label: string; value: number };

export function TrendChart({ points, color = "#9a5b3b" }: { points: Point[]; color?: string }) {
  const width = 760;
  const height = 250;
  const pad = 24;
  const max = Math.max(1, ...points.map(point => point.value));
  const coordinates = points.map((point, index) => ({
    x: pad + index * (width - 2 * pad) / Math.max(1, points.length - 1),
    y: height - pad - (point.value / max) * (height - 2 * pad),
  }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = coordinates.length ? `${line} L${coordinates.at(-1)!.x},${height - pad} L${coordinates[0].x},${height - pad} Z` : "";
  return <div className="w-full">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de ventas" className="h-64 w-full overflow-visible">
      {[0, 1, 2, 3].map(i => <line key={i} x1={pad} x2={width - pad} y1={pad + i * (height - 2 * pad) / 3} y2={pad + i * (height - 2 * pad) / 3} stroke="#e2e8f0" strokeDasharray="4 5" />)}
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="8" fill={color} opacity="0" className="hover:opacity-100"><title>{points[index].label}: S/ {points[index].value.toFixed(2)}</title></circle>)}
    </svg>
    <div className="flex justify-between gap-2 text-xs font-medium text-slate-500">{points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 5)) === 0).map((point, index) => <span key={index}>{point.label}</span>)}</div>
  </div>;
}
