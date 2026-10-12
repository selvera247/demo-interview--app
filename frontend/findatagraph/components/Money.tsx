export default function Money({
  value,
  currency = "USD",
}: {
  value: number | null | undefined;
  currency?: string;
}) {
  if (value == null || Number.isNaN(Number(value))) {
    return <span className="fdg-money muted">—</span>;
  }
  const formatted = Number(value).toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return <span className="fdg-money">{formatted}</span>;
}
