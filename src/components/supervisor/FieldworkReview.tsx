'use client';
import { useState, type CSSProperties } from 'react';
import type { FieldworkActivity } from '@/types';

const typeLabel: Record<string,string> = { direct:'مباشرة', indirect:'غير مباشرة', supervision_direct:'إشراف مباشر', supervision_indirect:'إشراف غير مباشر' };
type ReviewAction = 'approve'|'revision'|'reject';

export default function FieldworkReview({ initialActivities, trainees }: { initialActivities: FieldworkActivity[]; trainees: any[] }) {
  const [items,setItems]=useState(initialActivities);
  const [busy,setBusy]=useState('');
  const [pending,setPending]=useState<{id:string;action:ReviewAction}|null>(null);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');

  const review=async(id:string,action:ReviewAction,reviewerNote='')=>{
    setBusy(id); setError('');
    const res=await fetch('/api/supervisor/fieldwork',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,note:reviewerNote})});
    const data=await res.json().catch(()=>({}));
    if(res.ok){setItems(v=>v.filter(x=>x.id!==id));setPending(null);setNote('');}
    else setError(data.error||'تعذر حفظ المراجعة');
    setBusy('');
  };
  const requestNote=(id:string,action:ReviewAction)=>{setPending({id,action});setNote('');setError('');};

  return <>
    <div style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:16,overflow:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}><thead><tr>{['المتدرب','التاريخ','النوع','المدة','الوصف','الإجراء'].map(h=><th key={h} style={{padding:12,textAlign:'right',fontSize:12,color:'#64748B',borderBottom:'1px solid #E2E8F0'}}>{h}</th>)}</tr></thead><tbody>{items.map(a=><tr key={a.id}><td style={td}>{trainees.find(t=>t.id===a.traineeId)?.name||'—'}</td><td style={td}>{a.date}</td><td style={td}>{typeLabel[a.activityType]}</td><td style={td}>{a.duration} ساعة</td><td style={td}>{a.description}</td><td style={{...td,whiteSpace:'nowrap'}}><button disabled={busy===a.id} onClick={()=>review(a.id,'approve')} style={btn('#059669')}>اعتماد</button><button disabled={busy===a.id} onClick={()=>requestNote(a.id,'revision')} style={btn('#D97706')}>طلب تعديل</button><button disabled={busy===a.id} onClick={()=>requestNote(a.id,'reject')} style={btn('#DC2626')}>رفض</button></td></tr>)}{!items.length&&<tr><td colSpan={6} style={{padding:35,textAlign:'center',color:'#64748B'}}>لا توجد ساعات بانتظار المراجعة</td></tr>}</tbody></table></div>
    {pending&&<div style={overlay} onClick={e=>e.target===e.currentTarget&&setPending(null)}><div style={modal} dir="rtl"><h3 style={{margin:'0 0 6px'}}>{pending.action==='revision'?'طلب تعديل الساعات':'رفض الساعات'}</h3><p style={{fontSize:13,color:'#64748B',margin:'0 0 14px'}}>اكتب ملاحظة واضحة ستظهر للمتدرب داخل لوحته.</p><textarea autoFocus value={note} onChange={e=>setNote(e.target.value)} placeholder="اكتب الملاحظة هنا..." style={{width:'100%',minHeight:110,padding:12,border:'1px solid #CBD5E1',borderRadius:10,font:'inherit',resize:'vertical'}}/>{error&&<p style={{color:'#DC2626',fontSize:12}}>{error}</p>}<div style={{display:'flex',gap:8,marginTop:14}}><button disabled={!note.trim()||!!busy} onClick={()=>review(pending.id,pending.action,note)} style={{...btn(pending.action==='reject'?'#DC2626':'#D97706'),padding:'9px 16px',background:pending.action==='reject'?'#DC2626':'#D97706',color:'#fff'}}>حفظ وإرسال</button><button onClick={()=>setPending(null)} style={{...btn('#64748B'),padding:'9px 16px'}}>إلغاء</button></div></div></div>}
  </>;
}
const td:CSSProperties={padding:12,fontSize:13,borderBottom:'1px solid #F1F5F9'};
const btn=(color:string):CSSProperties=>({border:`1px solid ${color}`,color,background:'#fff',borderRadius:7,padding:'5px 9px',marginLeft:5,cursor:'pointer',fontFamily:'inherit'});
const overlay:CSSProperties={position:'fixed',inset:0,background:'#00144299',display:'grid',placeItems:'center',padding:16,zIndex:1000};
const modal:CSSProperties={width:'min(480px,100%)',background:'#fff',borderRadius:16,padding:22,boxShadow:'0 24px 70px #00144244'};
