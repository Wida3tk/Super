// Synthetic local-only seed for the Firebase emulator. Refuses to run without emulator hosts.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("emulator only");
const { initializeApp } = require(require.resolve("firebase-admin/app",{paths:[process.cwd()]}));
const { getFirestore } = require(require.resolve("firebase-admin/firestore",{paths:[process.cwd()]}));
const { getAuth } = require(require.resolve("firebase-admin/auth",{paths:[process.cwd()]}));
const app = initializeApp({ projectId: "demo-super" });
const db = getFirestore(app, "default"), auth = getAuth(app);
const now = new Date("2026-11-02T09:00:00Z"), iso = d => d.toISOString();
const M = "2026-11", P = "2026-10";
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); const pick = a => a[Math.floor(rnd() * a.length)];
(async () => {
  const batch = []; const put = (c, id, d) => batch.push([c, id, d]);
  const sups = [["SUP-1","د. هند العتيبي","hind@sulukera.test","supervisor",4],["SUP-2","أ. فهد القحطاني","fahad@sulukera.test","supervisor",2],["SUP-3","أ. منى الدوسري","mona@sulukera.test","supervisor",0],["SUP-4","أ. سامي الحربي","sami@sulukera.test","consultant",0]];
  for (const [id,name,email,type,seats] of sups) put("supervisors", id, { name, email, photo:"", bio:"", totalSessions: Math.floor(rnd()*80), ratingAverage: 4+rnd(), isActive:true, accountType:type, availableSeats:seats, createdAt: iso(now) });
  const first=["ريم","نورة","عبدالله","سارة","خالد","لمى","فيصل","جود","هيا","تركي","دانة","ماجد","رهف","يزيد","شهد","عمر","أروى","مها"], last=["الشهري","الزهراني","الغامدي","المطيري","السبيعي","العنزي"];
  const stages=[["active","active_service"],["active","active_service"],["active","active_service"],["active","active_service"],["active","active_service"],["onboarding","registered"],["onboarding","initial_interview"],["onboarding","post_interview"],["onboarding","contracting"],["paused","approved_pause"],["completed","completed"]];
  const trainees=[];
  for (let i=0;i<18;i++){ const [status,lc]=i<10?["active","active_service"]:stages[i%stages.length]; const sup=status==="active"||status==="paused"||status==="completed"?pick(["SUP-1","SUP-1","SUP-2","SUP-3"]):""; const lic=i%3?"QASP-S":"QBA"; const ind=Math.round(rnd()*60), grp=Math.round(rnd()*15);
    const t={ name:`${first[i]} ${last[i%6]}`, email:`trainee${i+1}@example.test`, phone:`05500000${String(i).padStart(2,"0")}`, license:lic, requiredHours:lic==="QBA"?2000:1500, status, lifecycleStage:lc, currentSupervisorId:sup, interviewSupervisorId: sup||"SUP-1", onboardingStage: status==="onboarding"?(lc==="contracting"?"contracting":lc==="post_interview"?"awaiting_decisions":"initial_interview"):undefined, registrationSource: lc==="registered"?"self_registration":"admin", createdAt: iso(new Date(now-86400e3*(30+i*9))), updatedAt: iso(now), totalIndividualHours:ind, totalGroupHours:grp, totalHours:ind+grp, approvedDirectHours:Math.round(rnd()*600), approvedIndirectHours:Math.round(rnd()*400), serviceAccessEnabled:true, accountStatus:"active" };
    Object.keys(t).forEach(k=>t[k]===undefined&&delete t[k]); const id=`TR-${String(i+1).padStart(3,"0")}`; trainees.push({id,...t}); put("trainees",id,t); }
  let n=0; const types=["direct","direct","indirect","supervision_direct","supervision_indirect"];
  for (const t of trainees.filter(t=>t.status==="active")) for (const month of [P,M]) for (let k=0;k<(month===M?4:7);k++){ const day=month===M?1+Math.floor(rnd()*2):1+Math.floor(rnd()*28); const ty=pick(types); const dur=ty.startsWith("supervision")?pick([1,1.5,2]):pick([2,3,4,5]); const st=month===P?"approved":pick(["submitted","submitted","approved","draft"]);
    put("fieldworkActivities",`FW-${++n}`,{ traineeId:t.id, supervisorId:t.currentSupervisorId, date:`${month}-${String(day).padStart(2,"0")}`, month, startTime:"09:00", endTime:"11:00", duration:dur, activityType:ty, setting:"in_person", format: ty.startsWith("supervision")?pick(["individual","individual","group"]):undefined, description:"نشاط ميداني تجريبي", activityCategory:"service_delivery", status:st, createdAt:iso(now), updatedAt:iso(now) }); }
  batch.forEach(r=>{ Object.keys(r[2]).forEach(k=>r[2][k]===undefined&&delete r[2][k]); });
  n=0; for (const t of trainees.filter(t=>t.status==="active")) for (const month of [P,M]) { put("sessions",`SE-${++n}`,{ supervisorId:t.currentSupervisorId, traineeIds:[t.id], type:"individual", date:`${month}-0${1+n%2}`, month, duration:1, createdAt:iso(now), createdBy:t.currentSupervisorId });
    put("monthlySnapshots",`${t.currentSupervisorId}_${t.id}_${month}`,{ supervisorId:t.currentSupervisorId, traineeId:t.id, month, workHours:80, requiredHours:4, individualHours:3, groupHours:1, totalHours:4, groupPercentage:25, absenceCount: n%5===0?3:0, warningCount:0, updatedAt:iso(now) });
    if (month===P) put("monthlyApprovals",`${t.id}_${month}`,{ traineeId:t.id, supervisorId:t.currentSupervisorId, month, status: n%3?"admin_approved":"supervisor_approved", supervisorApprovedAt: iso(now) }); }
  for (let i=0;i<8;i++){ const s=pick(["SUP-1","SUP-2","SUP-4"]); put("bookings",`BK-${i}`,{ studentName:`${pick(first)} ${pick(last)}`, studentEmail:`lead${i}@example.test`, studentPhone:"0550000000", supervisorId:s, supervisorName:sups.find(x=>x[0]===s)[1], date: i<5?`2026-11-${String(3+i).padStart(2,"0")}`:`2026-10-${String(20+i).padStart(2,"0")}`, time:"10:00", meetLink:"", googleEventId:"", status: i===6?"cancelled":"confirmed", managementToken:`tok${i}`, referenceNumber:`REF-${1000+i}`, bookingType: s==="SUP-4"?"consultation":"initial_interview", meetingStatus: i<5?"pending":"completed", createdAt: iso(new Date(now-86400e3*i)) }); }
  for (let i=0;i<10;i++) put("availability",`AV-${i}`,{ supervisorId: pick(["SUP-1","SUP-2","SUP-4"]), date:`2026-11-${String(4+i).padStart(2,"0")}`, time: pick(["10:00","13:00","16:00"]), isBooked:false });
  for (let i=0;i<4;i++) put("notifications",`NT-${i}`,{ targetType: i<2?"supervisor":"trainee", targetId: i<2?"SUP-1":"TR-001", title:"تذكير تجريبي", message:"يرجى مراجعة ساعات الشهر الحالي قبل نهاية الأسبوع.", read:false, createdAt: iso(new Date(now-3600e3*i)) });
  put("notifications","NT-admin",{ targetType:"admin", title:"طلب جديد", message:"طلب تسجيل جديد بانتظار المراجعة", read:false, createdAt:iso(now) });
  for (let i=0;i<3;i++) put("clients",`CL-${i}`,{ name:`عميل تجريبي ${i+1}`, email:`client${i}@example.test`, phone:"0550000000", createdAt: iso(new Date(now-86400e3*i)) });
  for (let i=0;i<4;i++) put("traineeRequests",`RQ-${i}`,{ traineeId:`TR-00${i+1}`, traineeName: trainees[i].name, supervisorId: trainees[i].currentSupervisorId, type: pick(["pause","transfer","document","other"]), status: i<3?"pending":"resolved", details:"طلب تجريبي", createdAt: iso(new Date(now-86400e3*i)) });
  for (let i=0;i<6;i++) put("activityLog",`AL-${i}`,{ type:"session_logged", message:`سجّل المشرف ساعة إشراف للمتدرب ${trainees[i].name}`, createdAt: iso(new Date(now-3600e3*i*3)) });
  for (let i=0;i<batch.length;i+=400){ const b=db.batch(); batch.slice(i,i+400).forEach(([c,id,d])=>b.set(db.collection(c).doc(id),d)); await b.commit(); }
  const users=[["admin","admin@sulukera.test",null],["sup","hind@sulukera.test","SUP-1"],["trainee","trainee1@example.test","TR-001"]];
  const out={};
  for (const [k,email,doc] of users){ let u; try{u=await auth.getUserByEmail(email)}catch{u=await auth.createUser({email,password:"Passw0rd!x"})}
    if(k==="trainee"){ await db.collection("trainees").doc(doc).update({authUid:u.uid}); await auth.setCustomUserClaims(u.uid,{traineeId:doc}); }
    if(k==="sup"){ await db.collection("supervisors").doc(doc).update({authUid:u.uid}); }
    const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password:"Passw0rd!x",returnSecureToken:true})}).then(r=>r.json());
    out[k]=await auth.createSessionCookie(r.idToken,{expiresIn:12*3600e3}); }
  require("fs").writeFileSync(__dirname+"/cookies.json",JSON.stringify(out)); console.log("seeded",batch.length,"docs");
})().catch(e=>{console.error(e);process.exit(1)});
