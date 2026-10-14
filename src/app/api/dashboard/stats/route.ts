import {NextResponse} from 'next/server';
import {listProperties} from '@/lib/properties';
import {accessResponse} from '@/lib/access';
export async function GET(){try{const {properties}=await listProperties();return NextResponse.json({totalProperties:properties.length,active:properties.filter(p=>p.status!=='Launched').length,pendingReview:properties.filter(p=>p.submitted_at).length,completed:properties.filter(p=>p.status==='Launched').length,pagesCrawled:properties.reduce((n,p)=>n+p.readable_pages,0),filesProcessed:properties.reduce((n,p)=>n+p.document_count,0),workspaces:properties});}catch(e){return accessResponse(e);}}
