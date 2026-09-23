import {readStore,writeCommand} from '@/lib/pos/storage';
import {z} from 'zod';
import {hasSession,validOrigin} from '@/lib/auth/server';
import {StoreUnavailableError} from '@/lib/pos/storage-core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){if(!await hasSession())return Response.json({error:'Please sign in'},{status:401,headers});try{return Response.json(await readStore(),{headers})}catch{return Response.json({error:'The store is temporarily unavailable. Please try again.'},{status:503,headers})}}
export async function POST(request:Request){if(!await hasSession())return Response.json({error:'Please sign in'},{status:401,headers});if(!validOrigin(request))return Response.json({error:'Invalid request origin'},{status:403,headers});try{const raw=await request.text();if(raw.length>200000)return Response.json({error:'Request is too large'},{status:413,headers});const p=z.object({action:z.string().max(40),payload:z.unknown(),requestId:z.string().uuid()}).parse(JSON.parse(raw));return Response.json(await writeCommand(p.action,p.payload,p.requestId),{headers})}catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400,headers});if(error instanceof StoreUnavailableError)return Response.json({error:error.message},{status:503,headers});if(error instanceof SyntaxError)return Response.json({error:'Invalid request body'},{status:400,headers});return Response.json({error:error instanceof Error?error.message:'Could not save changes'},{status:400,headers})}}
