export function formatCr(amount: number): string {
  return `₹${amount.toFixed(1)} Cr`
}

export function formatRole(role: string): string {
  switch (role) {
    case 'WK':
      return 'Wicket-Keeper'
    case 'BAT':
      return 'Batter'
    case 'BOWL':
      return 'Bowler'
    case 'AR':
      return 'All-Rounder'
    default:
      return role
  }
}

export function roleColor(role: string): string {
  switch (role) {
    case 'WK':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'BAT':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    case 'BOWL':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    case 'AR':
      return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }
}
