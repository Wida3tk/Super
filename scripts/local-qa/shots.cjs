const { chromium } = require('playwright');
const cookies = require('./cookies.json');
const out = process.argv[2], only = process.argv[3];
const pages = [
 ['public','/ar',null],['login','/ar/login',null],
 ['admin-home','/ar/admin','admin'],['admin-dashboard-dup','/ar/admin/dashboard','admin'],['admin-assignment','/ar/admin/assignment','admin'],['admin-productivity','/ar/admin/productivity','admin'],['admin-supervisors','/ar/admin/supervisors','admin'],['admin-supervisor-file','/ar/admin/supervisors/SUP-1','admin'],
 ['admin-bookings','/ar/admin/bookings','admin'],['admin-trainees','/ar/admin/trainees','admin'],['admin-trainee-file','/ar/admin/trainees/TR-001','admin'],['admin-onboarding','/ar/admin/onboarding','admin'],
 ['admin-months','/ar/admin/months','admin'],['admin-requests','/ar/admin/trainee-requests','admin'],['admin-operations','/ar/admin/operations','admin'],['admin-accounts','/ar/admin/accounts','admin'],['admin-export','/ar/admin/export','admin'],['admin-cms','/ar/admin/cms','admin'],['admin-notifications','/ar/admin/notifications','admin'],
 ['supervisor','/ar/supervisor-dashboard','sup'],['trainee','/ar/trainee-dashboard','trainee'],
];
(async () => {
  const browser = await chromium.launch();
  for (const [w,h,tag] of [[1440,900,'d'],[390,844,'m']]) {
    for (const [name,url,role] of pages) {
      if (only && !name.startsWith(only)) continue;
      const ctx = await browser.newContext({ viewport:{width:w,height:h}, locale:'ar' });
      if (role) await ctx.addCookies([{name:'__session',value:cookies[role],domain:'localhost',path:'/'}]);
      const p = await ctx.newPage(); const errs=[];
      p.on('pageerror',e=>errs.push(e.message));
      try { await p.goto('http://localhost:3000'+url,{waitUntil:'networkidle',timeout:90000}); } catch(e){ errs.push('goto '+e.message.slice(0,80)); }
      await p.waitForTimeout(800);
      await p.screenshot({path:`${out}/${name}-${tag}.png`, fullPage:true});
      const sw = await p.evaluate(()=>document.documentElement.scrollWidth);
      console.log(name,tag,p.url().replace('http://localhost:3000',''),'scrollW',sw, errs.slice(0,2).join(' | '));
      await ctx.close();
    }
  }
  await browser.close();
})();
