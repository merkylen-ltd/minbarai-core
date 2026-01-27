interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  loading?: boolean
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink'
}

const colorClasses = {
  blue: {
    bg: 'from-blue-500/10 to-blue-600/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    hover: 'hover:border-blue-500/40 hover:shadow-blue-500/10'
  },
  green: {
    bg: 'from-green-500/10 to-green-600/10',
    border: 'border-green-500/20',
    icon: 'text-green-400',
    hover: 'hover:border-green-500/40 hover:shadow-green-500/10'
  },
  purple: {
    bg: 'from-purple-500/10 to-purple-600/10',
    border: 'border-purple-500/20',
    icon: 'text-purple-400',
    hover: 'hover:border-purple-500/40 hover:shadow-purple-500/10'
  },
  orange: {
    bg: 'from-orange-500/10 to-orange-600/10',
    border: 'border-orange-500/20',
    icon: 'text-orange-400',
    hover: 'hover:border-orange-500/40 hover:shadow-orange-500/10'
  },
  pink: {
    bg: 'from-pink-500/10 to-pink-600/10',
    border: 'border-pink-500/20',
    icon: 'text-pink-400',
    hover: 'hover:border-pink-500/40 hover:shadow-pink-500/10'
  },
}

export default function MetricCard({ title, value, icon, trend, loading, color = 'blue' }: MetricCardProps) {
  const colors = colorClasses[color]

  if (loading) {
    return (
      <div className="bg-primary-700/30 border border-accent-500/10 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-primary-600/50 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-primary-600/50 rounded w-3/4"></div>
      </div>
    )
  }

  return (
    <div className={`relative bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl p-6 ${colors.hover} transition-all duration-200 overflow-hidden group shadow-lg`}>
      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-neutral-300 text-sm font-semibold uppercase tracking-wide">{title}</h3>
          <div className={`${colors.icon} transform group-hover:scale-110 transition-transform duration-200`}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div className="text-neutral-0 text-4xl font-display font-bold tracking-tight">
            {value}
          </div>
          
          {trend && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-sm font-bold ${
              trend.isPositive 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                {trend.isPositive ? (
                  <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                )}
              </svg>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
