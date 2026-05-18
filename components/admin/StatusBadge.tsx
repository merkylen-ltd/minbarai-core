type SubscriptionStatus = 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid' | 'suspended' | 'expired'

interface StatusBadgeProps {
  status: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: {
    label: 'Active',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  canceled: {
    label: 'Canceled',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  incomplete: {
    label: 'Incomplete',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  past_due: {
    label: 'Past Due',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  trialing: {
    label: 'Trial',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  unpaid: {
    label: 'Unpaid',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  },
  expired: {
    label: 'Expired',
    color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  },
  closed: {
    label: 'Closed',
    color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  },
  capped: {
    label: 'Capped',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-currentColor mr-1.5"></span>
      {config.label}
    </span>
  )
}
