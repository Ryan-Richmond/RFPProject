interface SparklineProps {
  /** Series of numeric data points (e.g. daily counts). */
  values: number[];
  width?: number;
  height?: number;
  /** CSS color value or var for the line. */
  color?: string;
  /** Optional area fill below the line. */
  fill?: boolean;
  /** Show small markers on each point. */
  showMarkers?: boolean;
  className?: string;
}

/**
 * Tiny inline SVG sparkline. Dependency-free.
 * Pads min/max range slightly so flat series don't collapse to a line.
 */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--primary)",
  fill = true,
  showMarkers = false,
  className,
}: SparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 1
      ? `${path} L${points[points.length - 1][0].toFixed(1)},${height - padding} L${points[0][0].toFixed(1)},${height - padding} Z`
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {fill && areaPath && (
        <path d={areaPath} fill={color} fillOpacity={0.12} />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showMarkers &&
        points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5} fill={color} />
        ))}
    </svg>
  );
}
