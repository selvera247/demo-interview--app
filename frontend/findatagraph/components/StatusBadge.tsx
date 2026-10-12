const LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  resolved: "Resolved",
  waived: "Waived",
  completed: "Completed",
  amount_mismatch: "Amount",
  missing_in_gl: "Missing GL",
  missing_in_crm: "Missing CRM",
  entity_mismatch: "Entity",
};

export default function StatusBadge({
  value,
  kind = "status",
}: {
  value: string;
  kind?: "status" | "type";
}) {
  const label = LABELS[value] || value;
  return (
    <span className={`fdg-badge fdg-badge-${kind} fdg-badge-${value}`}>
      {label}
    </span>
  );
}
