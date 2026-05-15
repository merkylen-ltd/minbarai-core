import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Health check endpoint for Google Cloud Run
 * Used by Cloud Run to verify the service is running properly
 */
export async function GET() {
  try {
    // Basic health check - you can add more sophisticated checks here
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(healthData, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Liveness probe endpoint
 * Simple endpoint that just returns 200 if the service is alive
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
