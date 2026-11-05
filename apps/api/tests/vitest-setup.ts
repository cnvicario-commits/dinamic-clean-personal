import { installPgPoolGuard, installTestProcessGuard } from './supabase-test-guard.js'

installTestProcessGuard()
installPgPoolGuard()
