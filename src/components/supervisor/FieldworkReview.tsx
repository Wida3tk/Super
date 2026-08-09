'use client';
import { useState, type CSSProperties } from 'react';
import type { FieldworkActivity } from '@/types';

const typeLabel: Record<string,string> = { direct:'مباشرة', indirect:'غير مباشرة', supervision_direct:'إشراف مباشر', supervision_indirect:'إشراف غير مباشر' };
export default function FieldworkReview({ initialActivities, trainees }: { initialActivities: FieldworkActivity[]; trainees: any[] }) {
  const [items,setItems]=useState(initialActivities); const [busy,setBusy]=useState('');
  const review=async(id:string,action:'approve'|'revision'|'reject')=>{const note=action==='approve'?'':window.prompt(action==='revision'?'ملاحظة التعديل المطلوبة:':'سبب الرفض:')||'';if(action!=='approve'&&!note)return;setBusy(id);const res=await fetch('/api/supervisor/fieldwork',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,note})});if(res.ok)setItems(v=>v.filter(x=>x.id!==id));setBusy('');};
  return <div style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:16,overflow:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}><thead><tr>{['المتدرب','التاريخ','النوع','المدة','الوصف','الإجراء'].map(h=><th key={h} style={{padding:12,textAlign:'right',fontSize:12,color:'#64748B',borderBottom:'1px solid #E2E8F0'}}>{h}</th>)}</tr></thead><tbody>{items.map(a=><tr key={a.id}><td style={td}>{trainees.find(t=>t.id===a.traineeId)?.name||'—'}</td><td style={td}>{a.date}</td><td style={td}>{typeLabel[a.activityType]}</td><td style={td}>{a.duration} ساعة</td><td style={td}>{a.description}</td><td style={{...td,whiteSpace:'nowrap'}}><button disabled={busy===a.id} onClick={()=>review(a.id,'approve')} style={btn('#059669')}>اعتماد</button><button disabled={busy===a.id} onClick={()=>review(a.id,'revision')} style={btn('#D97706')}>تعديل</button><button disabled={busy===a.id} onClick={()=>review(a.id,'reject')} style={btn('#DC2626')}>رفض</button></td></tr>)}{!items.length&&<tr><td colSpan={6} style={{padding:35,textAlign:'center',color:'#64748B'}}>لا توجد ساعات بانتظار المراجعة</td></tr>}</tbody></table></div>;
}
const td:CSSProperties={padding:12,fontSize:13,borderBottom:'1px solid #F1F5F9'};
const btn=(color:string):CSSProperties=>({border:`1px solid ${color}`,color,background:'#fff',borderRadius:7,padding:'5px 9px',marginLeft:5,cursor:'pointer'});
