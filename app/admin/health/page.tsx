'use client'

import { useEffect, useState } from 'react'

export default function HealthPage() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = () => {
      fetch('/api/admin/health/status')
        .then(r => r.json())
        .then(setHealth)
        .catch(console.error)
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Refresh every 30s
    setLoading(false)

    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="text-center py-12">
      <div className="flex items-center justify-center space-x-2">
        <div className="w-3 h-3 bg-accent-400 rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-3 h-3 bg-accent-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <div className="text-neutral-300 mt-4">Loading system health...</div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-accent-500/20 pb-6">
        <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neutral-0 to-neutral-200">
          System Health
        </h1>
        <p className="text-neutral-300 mt-2 text-lg">Monitor all service statuses and performance</p>
      </div>
      
      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {health?.services && Object.entries(health.services).map(([name, service]: [string, any]) => (
          <div key={name} className={`p-6 rounded-xl border shadow-lg transition-all duration-200 ${
            service.status === 'up' 
              ? 'bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 hover:border-green-500/40' 
              : service.status === 'down' 
              ? 'bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20 hover:border-red-500/40' 
              : 'bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-gray-500/20 hover:border-gray-500/40'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-neutral-0 font-semibold text-lg capitalize">{name}</h3>
              <div className={`w-3 h-3 rounded-full ${
                service.status === 'up' ? 'bg-green-400 animate-pulse' : 
                service.status === 'down' ? 'bg-red-400' : 
                'bg-gray-400'
              }`} />
            </div>
            
            <div className="space-y-2">
              {service.status === 'up' && service.responseTime && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 text-sm">Response Time</span>
                  <span className="text-green-300 font-mono font-semibold">{service.responseTime}ms</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-sm">Status</span>
                <span className={`text-sm font-semibold uppercase tracking-wide ${
                  service.status === 'up' ? 'text-green-300' :
                  service.status === 'down' ? 'text-red-300' :
                  'text-gray-300'
                }`}>
                  {service.status}
                </span>
              </div>

              {service.message && (
                <div className="mt-3 p-2 bg-primary-800/50 rounded text-neutral-300 text-xs">
                  {service.message}
                </div>
              )}

              {service.error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="text-red-300 text-xs font-medium">{service.error}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Last Checked */}
      <div className="flex items-center justify-between bg-primary-800/30 border border-accent-500/10 rounded-xl px-6 py-4">
        <span className="text-neutral-400 text-sm font-medium">Last Health Check</span>
        <span className="text-neutral-0 font-mono">
          {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
        </span>
      </div>
    </div>
  )
}
