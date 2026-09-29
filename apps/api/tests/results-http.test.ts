import { afterEach,describe,expect,it,vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ResultsRepository } from '../src/infrastructure/db/results-repository.js'
import { buildApp } from '../src/app.js'
import { createProfileStubDb,signAccessToken,testEnv } from './helpers.js'
const USER='22222222-2222-4222-8222-222222222222',ID='33333333-3333-4333-8333-333333333333'
const apps:FastifyInstance[]=[];afterEach(async()=>Promise.all(apps.splice(0).map(a=>a.close())))
function repo(){return{list:vi.fn(async()=>[]),detail:vi.fn(async()=>({id:ID,anio:2026,mes:1,details:[]})),preview:vi.fn(async()=>({total:1,valid:1,invalid:0,newRows:1,updates:0,duplicates:[],errors:[]})),apply:vi.fn(async()=>({resultIds:[ID]}))} as unknown as ResultsRepository}
async function app(role:string){const a=await buildApp(testEnv(),{db:createProfileStubDb({profile:{id:USER,nombre_completo:'User',rol:role}}),resultsRepo:repo()});apps.push(a);await a.ready();return a}
async function auth(){return{authorization:`Bearer ${await signAccessToken({sub:USER})}`}}
describe('Phase 4D Results HTTP/RBAC',()=>{
 it('requires auth and denies non-finance roles',async()=>{expect((await(await app('admin')).inject({method:'GET',url:'/v1/results'})).statusCode).toBe(401);for(const role of ['gerente','compras','supervisor','auditoria'])expect((await(await app(role)).inject({method:'GET',url:'/v1/results',headers:await auth()})).statusCode).toBe(403)})
 it('allows admin read and requires idempotency for apply',async()=>{const a=await app('admin'),headers=await auth();expect((await a.inject({method:'GET',url:'/v1/results',headers})).statusCode).toBe(200);expect((await a.inject({method:'POST',url:'/v1/results/import/apply',headers,payload:{rows:[]}})).statusCode).toBe(400)})
})
