/* Local note parsing: keep the source text, count only explicit time outside parentheses. */
(function(root){
 'use strict';
 const clean=s=>s.replace(/^[\s+＋,，;；]+|[\s+＋,，;；]+$/g,'').trim();
 function validDate(y,m,d){const x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d}
 function classify(text){
  const title=text.split(/[（(]/)[0].toLowerCase();
  function match(t){
   if(/交替拨弦|严格上下拨/.test(t))return '交替拨弦';
   if(/听唱|复唱|扒谱/.test(t))return '听唱';
   if(/funk|放克/.test(t))return 'Funk 扫弦';
   if(/blucu|blues\s*lick|solo|即兴|五声音阶连接/.test(t))return 'Solo 即兴';
   if(/bucu|blues\s*you\s*can\s*use|blues\s*rock\s*tone|texas|布鲁斯应用|主线教材/.test(t))return 'Blues You Can Use';
   if(/前奏|slow\s*dancing|gravity|完整曲目/.test(t))return '完整曲目';
   if(/维护池|练习池/.test(t))return '维护池';
   if(/手指机能|爬格子/.test(t))return '手指机能';
   if(/弹唱|^唱(?:\s|[（(]|$)/.test(t))return '弹唱';
   return null;
  }
  if(/手指机能/.test(title)&&/交替拨弦/.test(text))return '交替拨弦';
  return match(title)||match(text.toLowerCase())||'历史综合练习';
 }
 function speed(text){
  const found=[];const re=/(\d{2,3})\s*(?:的\s*)?bpm\b|\bbpm\s*[:：]?\s*(\d{2,3})/ig;let m;
  while((m=re.exec(text))){const before=text.slice(Math.max(0,m.index-12),m.index);const after=text.slice(re.lastIndex,re.lastIndex+12);
   found.push({value:Number(m[1]||m[2]),planned:/(?:目标|练到|达到|直到|提到|提速到|考虑从|得从|需要从|计划从|回到|从)\s*$/.test(before)||/^(?:开始|起步|起练)/.test(after)})
  }
  const actual=found.filter(x=>!x.planned).map(x=>x.value);
  return {bpm:actual[0]||null,bpmEnd:actual.length>1?actual.at(-1):null,bpmPlans:found.filter(x=>x.planned).map(x=>x.value)};
 }
 function timedParts(body){
  const re=/(\d+(?:\.\d+)?)\s*(minutes?|mins?|分钟|小时|hours?|h(?![a-z])|m(?![a-z]))/ig;
  const marks=[];let depth=0,pos=0,m;
  while((m=re.exec(body))){for(;pos<m.index;pos++){if(/[（(\[【]/.test(body[pos]))depth++;else if(/[）)\]】]/.test(body[pos]))depth=Math.max(0,depth-1)}if(depth)continue;
   if(marks.length&&/(?:总共|总计|合计|累计)\s*(?:时长)?\s*[:：]?\s*$/.test(body.slice(Math.max(0,m.index-12),m.index)))continue;
   const hours=/^(h|hour|hours|小时)$/i.test(m[2]);let minutes=Number(m[1])*(hours?60:1);
   const prev=marks.at(-1);
   if(prev&&prev.hours&&!hours&&/^\s*$/.test(body.slice(prev.end,m.index))){prev.minutes+=minutes;prev.end=re.lastIndex;prev.hours=false;continue}
   marks.push({start:m.index,end:re.lastIndex,minutes,hours});
  }
  return marks.map((x,i)=>({minutes:x.minutes,text:clean(body.slice(x.end,marks[i+1]?.start??body.length)),raw:clean(body.slice(x.start,marks[i+1]?.start??body.length))}));
 }
 function parse(text,defaultYear=new Date().getFullYear()){
  let year=Number(defaultYear),current=null;const days=[],warnings=[];
  for(const rawLine of text.replace(/\r/g,'').split('\n')){
   const line=rawLine.trim();if(!line)continue;
   const ym=line.match(/^(20\d{2})\s*年\s*[:：]?$/);if(ym){year=Number(ym[1]);continue}
   let m=line.match(/^(?:(20\d{2})[-/.年])?(\d{1,2})[.．/月-](\d{1,2})(?:日)?\s*[:：]\s*(.*)$/);
   if(m){
    const y=Number(m[1]||year),mo=Number(m[2]),d=Number(m[3]);
    if(!validDate(y,mo,d)){warnings.push('无效日期：'+line);current=null;continue}
    year=y;const date=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    current=days.find(x=>x.date===date);if(!current){current={date,body:'',raw:''};days.push(current)}
    current.body+=(current.body?' + ':'')+m[4];current.raw+=(current.raw?'\n':'')+rawLine;continue;
   }
   if(/^(?:[一二三四五六七八九十]+月|\d{1,2}月|累计|练琴天数|未练琴|日历日平均|实际练琴日平均|单日最长|\d+\s*月累计)/.test(line)){current=null;continue}
   if(current){current.body+='\n'+line;current.raw+='\n'+rawLine}else warnings.push('保留了未归属日期的文字，请补日期：'+line);
  }
  for(const day of days){
   day.entries=[];day.warnings=[];day.blocked=false;day.partial=/。{2,}|…{2,}|\.{3,}|未写完|待补|未完/.test(day.body);
   const parts=timedParts(day.body);
   let depth=0;for(const c of day.body){if(/[（(【\[]/.test(c))depth++;else if(/[）)】\]]/.test(c))depth--}
   if(depth!==0){day.blocked=true;day.warnings.push('括号未配对，暂不导入这天，以免漏算括号后的练习。')}
   if(/(?:^|[+＋])\s*\d+(?:\.\d+)?\s*(?:听唱|弹唱|solo|机能|维护池|前奏|练琴)/i.test(day.body)){day.blocked=true;day.warnings.push('有时长未写单位，暂不导入这天；补上 min 或 h 即可。')}

   for(const part of parts){
    if(part.minutes===0)continue;
    if(!Number.isInteger(part.minutes)||part.minutes<0){day.warnings.push('时长无法按整分钟计入：'+part.raw);continue}
    const module=classify(part.text);const bpm=speed(part.text);
    const accuracy=part.text.match(/准确率\s*[:：]?\s*(\d+(?:\.\d+)?)\s*[%％]/);
    const stability=part.text.match(/稳定性\s*[:：]?\s*([1-5])\s*\/\s*5/);
    day.entries.push({date:day.date,module,minutes:part.minutes,detail:part.text||'原日志仅记录时长。',...bpm,accuracy:accuracy&&Number(accuracy[1])<=100?Number(accuracy[1]):null,stability:stability?stability[1]:null,self:'',review:'',next:'',source:'备忘录原文',raw:part.raw});
    if(module==='历史综合练习')day.warnings.push('有一段未确定模块，先计入综合练习，原文保留。');
   }
   day.rest=!day.entries.length&&(/^\s*0(?:[^\d.]|$)/.test(day.body)||/(?:^|[^\d])0\s*(?:min|分钟|h|小时|\s)|没(?:有)?练琴|未练琴/.test(day.body));
   if(!day.entries.length&&!day.rest)day.warnings.push('没有识别出明确时长，暂不计时。');
   day.minutes=day.entries.reduce((n,e)=>n+e.minutes,0);
   if(day.partial)day.warnings.push('原文以省略号结束，暂按已写出的时长记录。');
  }
  return {days,warnings,raw:text};
 }
 function signature(entries){const map={};for(const e of entries)map[e.module]=(map[e.module]||0)+Number(e.minutes);return JSON.stringify(Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])))}
 function plan(parsed,state){return parsed.days.map(day=>{
  const existing=state.entries.filter(e=>e.date===day.date);const rest=Object.hasOwn(state.restDays||{},day.date);
  let status=!day.blocked&&(day.entries.length||day.rest)?'new':'invalid';
  if(status!=='invalid'&&(existing.length||rest))status=signature(existing)===signature(day.entries)&&rest===day.rest?'duplicate':'conflict';
  return {...day,status,existingMinutes:existing.reduce((n,e)=>n+Number(e.minutes),0)};
 })}
 root.NoteParser={parse,plan,signature,classify,timedParts,speed};
})(typeof window==='undefined'?globalThis:window);
