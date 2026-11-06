import projectSeed from './src/data/proyek.json' with { type: 'json' }
import reportSeed from './src/data/laporan.json' with { type: 'json' }
import contractorSeed from './src/data/kontraktor.json' with { type: 'json' }
import knowledgeSeed from './src/data/pengetahuan.json' with { type: 'json' }
import { businessDate, createDemoProvider, deepFreeze, DEMO_LABEL } from './src/lib/demo-domain.js'

export { createDemoProvider, DomainError, DEMO_LABEL, POLICY_LABEL } from './src/lib/demo-domain.js'
export const DEMO_TODAY = businessDate()
export const DEMO_REVIEWER = deepFreeze({ id: 'reviewer-demo', role: 'reviewer', projectCodes: projectSeed.map((p) => p.kode) })
export const DEMO_ADMIN = deepFreeze({ id: 'admin-demo', role: 'admin', projectCodes: projectSeed.map((p) => p.kode) })
export const DEMO_CONTRACTOR = deepFreeze({ id: 'contractor-demo', role: 'contractor', projectCodes: contractorSeed.paket.map((p) => p.kode) })
let storage = null
try { storage = globalThis.sessionStorage ?? null } catch { /* Session storage may be blocked; provider exposes memory-only mode. */ }
export const provider = createDemoProvider({ projects: projectSeed, reports: reportSeed, contractor: contractorSeed, knowledge: knowledgeSeed, storage })
export const projects = provider.getProjects()
export const packages = provider.getPackages()
export const demoLabel = DEMO_LABEL
