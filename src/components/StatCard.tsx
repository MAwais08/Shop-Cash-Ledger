export default function StatCard({
  label,
  value,
  accent = 'text-slate-900',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
    </div>
  )
}
