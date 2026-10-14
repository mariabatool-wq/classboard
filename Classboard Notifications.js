// Classboard Notifications — paste this into the Scriptable script with this EXACT name.
// Run from Classboard's Sync Notifications button on the iPad.
const params = args.queryParameters || {};
const payload = params.payload;
if (!payload) {
  const a = new Alert(); a.title = 'Classboard Sync';
  a.message = 'Open your Classboard website on this iPad and tap Sync Notifications. Running this script alone does not sync.';
  a.addAction('OK'); await a.presentAlert(); Script.complete();
} else {
  try {
    const parsed = JSON.parse(payload);
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || parsed.tasks.length > 200) throw new Error('Invalid reminder data');
    const now = Date.now();
    const start = new Date();
    const horizon = new Date(now + 30 * 86400000);
    const scheduled = [];
    const allowed = new Set([0,5,10,15,30,45,60]);
    function format(t,o){
      let body = t.message || '{title} starts in {minutes}!';
      return body.replaceAll('{title}',t.title).replaceAll('{minutes}',o===0?'now':o+' minutes');
    }
    for (const t of parsed.tasks) {
      if (!t || typeof t.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !/^\d{2}:\d{2}$/.test(t.time) || !Array.isArray(t.offsets)) continue;
      const [y,m,d]=t.date.split('-').map(Number); const [hh,mm]=t.time.split(':').map(Number);
      if(hh>23||mm>59||m<1||m>12||d<1||d>31)continue;
      const first=new Date(y,m-1,d,hh,mm,0,0);
      if(first.getFullYear()!==y||first.getMonth()!==m-1||first.getDate()!==d)continue;
      for (let n=0; n<32; n++) {
        if(t.repeat==='none' && n>0) break;
        let occur=new Date(first);
        if(t.repeat==='daily') occur.setDate(occur.getDate()+n);
        else if(t.repeat==='weekly') occur.setDate(occur.getDate()+n*7);
        else if(t.repeat!=='none')break;
        if (occur>horizon)break;
        // Don't submit notifications that would fire in the past.
        for(const offset of new Set(t.offsets.map(Number).filter(x=>allowed.has(x)))){
          const when=new Date(occur.getTime()-offset*60000);
          if(when.getTime()<=now+1000 || when>horizon)continue;
          scheduled.push({when,title:t.title,body:format(t,offset),id:'classboard:'+encodeURIComponent(String(t.id)).slice(0,80)+':'+occur.getTime()+':'+offset});
        }
      }
    }
    scheduled.sort((a,b)=>a.when-b.when);
    // iOS limits outstanding local notifications. Keep space for other Scriptable scripts.
    const LIMIT=56;
    const picks=scheduled.slice(0,LIMIT);
    const current=await Notification.allPending();
    const old=current.filter(n=>String(n.identifier||'').startsWith('classboard:')).map(n=>n.identifier);
    if(old.length)await Notification.removePending(old);
    let made=0;
    for(const item of picks){
      const note=new Notification(); note.identifier=item.id; note.title='📚 '+item.title;
      note.body=item.body; note.setTriggerDate(item.when); await note.schedule(); made++;
    }
    const a=new Alert(); a.title='Classboard synced ✅';
    a.message='Scheduled '+made+' future notification(s).'+(scheduled.length>LIMIT?' Only the earliest '+LIMIT+' were scheduled due to iPad notification limits. Sync again later for more.':'')+'\nOld Classboard alerts were replaced. Other Scriptable alerts were untouched.';
    a.addAction('OK'); await a.presentAlert();
  } catch(e){const a=new Alert();a.title='Sync failed';a.message=String(e)+'\nYour Classboard reminders were not fully synchronized. Please try again.';a.addAction('OK');await a.presentAlert();}
  Script.complete();
}
