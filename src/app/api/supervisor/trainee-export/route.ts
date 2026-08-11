export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { buildCompliance } from '@/lib/qaba/compliance';
import type { FieldworkActivity } from '@/types';

const activityLabels: Record<string,string> = { direct:'مباشرة', indirect:'غير مباشرة', supervision_direct:'إشراف على ساعات مباشرة', supervision_indirect:'إشراف على ساعات غير مباشرة' };

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const traineeId = req.nextUrl.searchParams.get('traineeId');
  if (!traineeId) return NextResponse.json({ error:'INVALID_TRAINEE' }, { status:400 });
  const traineeSnap = await adminDb.collection('trainees').doc(traineeId).get();
  if (!traineeSnap.exists || traineeSnap.data()?.currentSupervisorId !== supervisor.id) return NextResponse.json({ error:'FORBIDDEN' }, { status:403 });
  const [activitySnap, documentsSnap] = await Promise.all([
    adminDb.collection('fieldworkActivities').where('traineeId','==',traineeId).limit(2000).get(),
    adminDb.collection('supervisionDocuments').where('traineeId','==',traineeId).limit(100).get(),
  ]);
  const trainee = { id:traineeSnap.id, ...traineeSnap.data() } as any;
  const activities = activitySnap.docs.map(d=>({id:d.id,...d.data()})) as FieldworkActivity[];
  const approved = activities.filter(a=>a.status==='approved').sort((a,b)=>a.date.localeCompare(b.date));
  const compliance = buildCompliance(activities, trainee.license || 'QASP-S', trainee.fieldworkStartDate);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'سلوكيرا'; wb.created = new Date();
  const info = wb.addWorksheet('Supervisee Information', { views:[{rightToLeft:true}] });
  info.columns=[{width:28},{width:34},{width:28},{width:34}];
  info.mergeCells('A1:D1'); info.getCell('A1').value='سلوكيرا — بيانات المتدرب والإشراف'; info.getCell('A1').font={bold:true,size:18,color:{argb:'FFFFFFFF'}}; info.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF001442'}}; info.getCell('A1').alignment={horizontal:'center'};
  info.addRows([['اسم المتدرب',trainee.name,'المسار',trainee.license],['البريد الإلكتروني',trainee.email||'','رقم الهاتف',trainee.phone||''],['اسم المشرف',supervisor.name,'رقم اعتماد المشرف',String((supervisor as any).credentialNumber||'')],['بداية الخبرة',trainee.fieldworkStartDate||'','تاريخ التصدير',new Date().toISOString().slice(0,10)]]);
  const summary = wb.addWorksheet('Activity Dashboard', { views:[{rightToLeft:true}] });
  summary.columns = [{width:30},{width:23},{width:23},{width:23}];
  summary.mergeCells('A1:D1'); summary.getCell('A1').value='سلوكيرا — ملخص الخبرة الميدانية';
  summary.getCell('A1').font={bold:true,size:18,color:{argb:'FFFFFFFF'}}; summary.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF001442'}}; summary.getCell('A1').alignment={horizontal:'center'}; summary.getRow(1).height=34;
  const rows = [
    ['اسم المتدرب',trainee.name,'المسار',trainee.license],
    ['اسم المشرف',supervisor.name,'تاريخ التصدير',new Date().toISOString().slice(0,10)],
    ['إجمالي الخبرة',compliance.fieldwork,'الهدف',compliance.rules.total],
    ['الساعات المباشرة',compliance.direct,'الحد الأعلى',compliance.rules.maxDirect],
    ['الساعات غير المباشرة',compliance.indirect,'الحد الأدنى',compliance.rules.minIndirect],
    ['ساعات الإشراف',compliance.supervision,'نسبة الإشراف',compliance.fieldwork?compliance.supervision/compliance.fieldwork:0],
    ['الإشراف الجماعي',compliance.group,'نسبته من الإشراف',compliance.supervision?compliance.group/compliance.supervision:0],
  ];
  summary.addRows(rows);
  for(let r=2;r<=8;r++){ summary.getCell(r,1).font={bold:true,color:{argb:'FF001442'}}; summary.getCell(r,3).font={bold:true,color:{argb:'FF001442'}}; summary.getRow(r).height=24; }
  summary.getCell('D7').numFmt='0.0%'; summary.getCell('D8').numFmt='0.0%';

  const log = wb.addWorksheet('Activity Log', { views:[{state:'frozen',ySplit:1,rightToLeft:true}] });
  log.columns = [
    {header:'التاريخ',key:'date',width:14},{header:'وقت البداية',key:'start',width:14},{header:'وقت النهاية',key:'end',width:14},{header:'المدة',key:'duration',width:11},{header:'التصنيف',key:'type',width:25},{header:'طريقة الإشراف',key:'setting',width:19},{header:'الصيغة',key:'format',width:14},{header:'ملاحظة مع مستفيد',key:'observed',width:19},{header:'وصف النشاط',key:'description',width:55},{header:'المشرف',key:'supervisor',width:25},{header:'حالة الاعتماد',key:'status',width:16},
  ];
  approved.forEach(a=>log.addRow({date:a.date,start:a.startTime,end:a.endTime,duration:a.duration,type:activityLabels[a.activityType]||a.activityType,setting:a.setting==='in_person'?'حضوري':a.setting==='video'?'اتصال مرئي':'—',format:a.format==='group'?'جماعي':a.format==='individual'?'فردي':'—',observed:a.observedWithClient?'نعم':'لا',description:a.description,supervisor:supervisor.name,status:'معتمد'}));
  log.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; log.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D40FC'}}; log.getRow(1).alignment={horizontal:'center'}; log.autoFilter={from:'A1',to:'K1'};
  log.getColumn('duration').numFmt='0.00'; log.eachRow((row,n)=>{row.alignment={vertical:'middle',wrapText:true}; if(n>1&&n%2===0) row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F6FC'}};});

  const monthly = wb.addWorksheet('Activity Overview', { views:[{rightToLeft:true}] });
  monthly.columns=[{header:'الشهر',key:'month',width:15},{header:'ساعات الخبرة',key:'fieldwork',width:17},{header:'ساعات الإشراف',key:'supervision',width:17},{header:'نسبة الإشراف',key:'supervisionRate',width:17},{header:'نسبة الجماعي',key:'groupRate',width:17},{header:'20–140',key:'band',width:15},{header:'5%',key:'supervisionOk',width:15},{header:'الجماعي ≤50%',key:'groupOk',width:17}];
  compliance.months.forEach(m=>monthly.addRow({...m,band:m.validHoursBand?'مطابق':'يحتاج مراجعة',supervisionOk:m.meetsSupervision?'مطابق':'يحتاج مراجعة',groupOk:m.meetsGroupLimit?'مطابق':'يحتاج مراجعة'}));
  monthly.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; monthly.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF001442'}}; monthly.getColumn('supervisionRate').numFmt='0.0%'; monthly.getColumn('groupRate').numFmt='0.0%';

  const months=[...new Set(approved.map(a=>a.month))].sort();
  if(!months.length) months.push(new Date().toISOString().slice(0,7));
  months.forEach((month,index)=>{
    const sheet=wb.addWorksheet(`Month ${index+1}`,{views:[{state:'frozen',ySplit:9,rightToLeft:true}]});
    sheet.columns=[{width:6},{width:14},{width:14},{width:14},{width:11},{width:25},{width:18},{width:14},{width:18},{width:55},{width:22}];
    sheet.mergeCells('A1:K1');sheet.getCell('A1').value=`سلوكيرا — سجل شهر ${month}`;sheet.getCell('A1').font={bold:true,size:17,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF001442'}};sheet.getCell('A1').alignment={horizontal:'center'};
    sheet.getCell('A3').value='اسم المتدرب';sheet.getCell('B3').value=trainee.name;sheet.getCell('D3').value='المشرف';sheet.getCell('E3').value=supervisor.name;sheet.getCell('G3').value='الشهر';sheet.getCell('H3').value=month;
    sheet.getRow(9).values=['#','التاريخ','البداية','النهاية','المدة','نوع النشاط','طريقة الإشراف','الصيغة','ملاحظة مستفيد','وصف النشاط','حالة الاعتماد'];
    sheet.getRow(9).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(9).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D40FC'}};
    approved.filter(a=>a.month===month).forEach((a,i)=>sheet.addRow([i+1,a.date,a.startTime,a.endTime,a.duration,activityLabels[a.activityType]||a.activityType,a.setting==='in_person'?'حضوري':a.setting==='video'?'اتصال مرئي':'—',a.format==='group'?'جماعي':a.format==='individual'?'فردي':'—',a.observedWithClient?'نعم':'لا',a.description,'معتمد']));
  });

  const docs = wb.addWorksheet('المستندات', { views:[{rightToLeft:true}] });
  docs.columns=[{header:'نوع المستند',key:'type',width:25},{header:'العنوان',key:'title',width:35},{header:'تاريخ الإصدار',key:'issuedAt',width:16},{header:'تاريخ الانتهاء',key:'expiresAt',width:16},{header:'الحالة',key:'status',width:15},{header:'المركز',key:'centerName',width:25},{header:'رمز المستفيد',key:'clientCode',width:18}];
  documentsSnap.docs.forEach(d=>docs.addRow(d.data())); docs.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; docs.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D40FC'}};

  for(const sheet of wb.worksheets){ sheet.eachRow(row=>row.alignment={...row.alignment,vertical:'middle',wrapText:true}); sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}; }
  const buffer = await wb.xlsx.writeBuffer();
  const safeName=String(trainee.name||'trainee').replace(/[\\/:*?"<>|]/g,'-');
  return new NextResponse(Buffer.from(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(`Sulukera_${safeName}_Fieldwork.xlsx`)}`}});
}
