import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    release: process.env.APP_RELEASE_SHA || 'unknown',
    deployment: process.env.APP_DEPLOYMENT_ENV || 'unspecified',
  })
}
