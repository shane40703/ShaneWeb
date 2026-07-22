const subjects = [
  {id:'law', name:'建築法規與實務', icon:'⚖', desc:'建築法規、都市計畫、建築管理與實務應用'},
  {id:'env', name:'建築環境控制', icon:'◉', desc:'環境物理、熱濕空氣、光環境、音環境與設備'},
  {id:'construction', name:'建築構造與施工', icon:'▦', desc:'建築材料、構造原理、施工技術與工程管理'},
  {id:'structure', name:'建築結構', icon:'⌁', desc:'結構力學、鋼筋混凝土、鋼結構與基礎工程'}
];
const years = Array.from({length:13},(_,i)=>114-i);
const questions = [
  {id:1,year:114,subject:'law',topic:'建築技術規則',text:'依建築技術規則，住宅居室採光有效面積與樓地板面積之比例，原則上不得小於下列何者？',options:['1/5','1/8','1/10','1/12'],answer:1,explanation:'居室採光有效面積原則上不得小於該居室樓地板面積的八分之一。'},
  {id:2,year:114,subject:'env',topic:'熱環境',text:'建築外殼隔熱性能中，U 值越小通常代表什麼意義？',options:['隔熱性能越差','隔熱性能越好','熱容量越小','日射吸收率越高'],answer:1,explanation:'U 值為熱傳透率，數值越小表示熱量越不容易穿透，隔熱性能較佳。'},
  {id:3,year:114,subject:'construction',topic:'混凝土施工',text:'混凝土澆置後進行濕潤養護，最主要的目的為何？',options:['增加坍度','降低水化反應','避免水分過早散失','減少骨材用量'],answer:2,explanation:'養護可避免水分過早散失，使水泥水化反應充分進行並降低表面裂縫。'},
  {id:4,year:114,subject:'structure',topic:'結構力學',text:'簡支梁承受中央集中載重時，最大彎矩發生在何處？',options:['支承點','跨中','四分點','任意位置'],answer:1,explanation:'對稱中央集中載重下，剪力於跨中改變符號，因此最大彎矩位於跨中。'},
  {id:5,year:113,subject:'law',topic:'建築法',text:'建築物未經申請核准即擅自建造，通常屬於何種情形？',options:['合法使用','違章建築','危險建築','歷史建築'],answer:1,explanation:'未經主管建築機關審查許可而建造者，通常屬違章建築。'},
  {id:6,year:113,subject:'env',topic:'照明',text:'日光率主要用來評估下列哪一項性能？',options:['自然採光','自然通風','室內音響','熱傳導'],answer:0,explanation:'日光率是室內某點照度相對於同時室外全天空照度的比值，用於評估自然採光。'},
  {id:7,year:113,subject:'construction',topic:'防水工程',text:'屋頂防水層施工前，基層最重要的處理原則為何？',options:['保持濕潤積水','平整、乾燥、清潔','先鋪設磁磚','提高表面溫度'],answer:1,explanation:'基層平整、乾燥、清潔有助於防水材料黏著並減少空鼓與破壞。'},
  {id:8,year:113,subject:'structure',topic:'耐震設計',text:'建築物耐震設計中，延性設計的主要目的為何？',options:['提高自重','避免任何變形','藉塑性變形消散地震能量','降低材料強度'],answer:2,explanation:'延性使構件在不突然脆性破壞的情況下產生塑性變形並消散地震能量。'},
  {id:9,year:112,subject:'law',topic:'都市計畫法',text:'土地使用分區管制的主要目的為何？',options:['增加所有土地容積','合理安排土地使用並維護公共利益','取消建築限制','統一地價'],answer:1,explanation:'分區管制係依都市發展需求合理配置土地用途並維護公共安全與生活品質。'},
  {id:10,year:112,subject:'env',topic:'音環境',text:'提高牆體隔音性能，通常較直接有效的方法為何？',options:['減少牆體質量','增加牆體質量或採雙層構造','增加窗戶面積','降低室內吸音'],answer:1,explanation:'依質量定律，增加牆體面密度通常可提升隔音；雙層中空構造亦可改善性能。'},
  {id:11,year:112,subject:'construction',topic:'鋼構施工',text:'鋼構件高強度螺栓接合施工時，主要控制項目為何？',options:['塗裝顏色','預拉力與接合面狀況','構件重量','焊道長度'],answer:1,explanation:'高強度螺栓接合需控制螺栓預拉力及摩擦接合面狀況。'},
  {id:12,year:112,subject:'structure',topic:'鋼筋混凝土',text:'鋼筋混凝土梁配置箍筋的主要作用之一為何？',options:['承受剪力','增加混凝土比重','降低保護層厚度','取代主筋'],answer:0,explanation:'箍筋主要用於承受剪力、拘束混凝土及固定主筋位置。'},
  {id:13,year:111,subject:'law',topic:'無障礙設計',text:'無障礙坡道設計最重要的考量之一為何？',options:['坡度越陡越好','避免設置扶手','控制坡度並設置必要平台','僅供貨運使用'],answer:2,explanation:'坡道需控制適當坡度並依長度設置平台、扶手與防護。'},
  {id:14,year:111,subject:'env',topic:'通風',text:'自然通風中，風壓通風主要受何者影響？',options:['室內照度','建築物兩側風壓差','牆面顏色','樓板厚度'],answer:1,explanation:'風作用於建築物外表面產生不同壓力，形成開口間的風壓差並驅動氣流。'},
  {id:15,year:110,subject:'construction',topic:'基礎工程',text:'開挖工程中設置擋土支撐的主要目的為何？',options:['增加建物高度','防止土體坍方與鄰房變形','降低地下水位到零','減少施工人員'],answer:1,explanation:'擋土支撐用以維持開挖面穩定並控制鄰地沉陷與位移。'},
  {id:16,year:110,subject:'structure',topic:'基礎設計',text:'基礎發生不均勻沉陷時，最可能造成何種問題？',options:['建築物整體均勻下降且無損傷','構件產生附加應力與裂縫','提高耐震能力','減少結構變形'],answer:1,explanation:'不均勻沉陷會導致結構扭曲、附加應力、門窗變形及裂縫。'},
  {id:17,year:108,subject:'law',topic:'消防避難',text:'設置兩座以上直通樓梯的主要目的為何？',options:['增加樓地板面積','提供替代避難路徑','降低建築高度','減少出口寬度'],answer:1,explanation:'多方向且相互獨立的避難路徑，可在部分路徑受阻時提供替代選擇。'},
  {id:18,year:106,subject:'env',topic:'空調',text:'空調系統中，顯熱負荷主要造成室內何種變化？',options:['溫度變化','含濕量變化','氣味變化','照度變化'],answer:0,explanation:'顯熱改變空氣溫度而不直接改變含濕量；潛熱則涉及水分相變與含濕量。'},
  {id:19,year:104,subject:'construction',topic:'材料',text:'木材含水率變化最容易引起何種現象？',options:['腐蝕鋼筋','乾縮、膨脹或翹曲','增加混凝土強度','降低玻璃透光率'],answer:1,explanation:'木材會隨含水率變化產生尺寸變形，可能造成乾縮、膨脹與翹曲。'},
  {id:20,year:102,subject:'structure',topic:'載重',text:'結構設計中的活載重，通常係指何者？',options:['結構自重','固定設備永久重量','使用人員與可移動物品造成的載重','地震力'],answer:2,explanation:'活載重為使用過程中可能變動的位置或大小之載重，例如人員、家具及可移動設備。'}
];

const store = {
  get(key, fallback){try{return JSON.parse(localStorage.getItem('arch_'+key)) ?? fallback}catch{return fallback}},
  set(key,val){localStorage.setItem('arch_'+key,JSON.stringify(val))}
};
let answers = store.get('answers', {});
let difficult = store.get('difficult', []);
let history = store.get('history', []);
let notes = store.get('notes', [{id:Date.now(),title:'法規題複習方式',body:'作答後記錄法規名稱、條號與錯誤原因，並在一週內重新練習。',date:new Date().toLocaleDateString('zh-TW')}]);
let discussions = store.get('discussions', [
  {id:101,qid:1,type:'題目詳解',author:'匿名考生 #A12',body:'這題先抓關鍵字「住宅居室採光有效面積」。依建築技術規則的一般原則，採光有效面積不得小於樓地板面積的八分之一，因此答案選 B。實務上仍要留意特定用途與替代採光規定。',date:'2026/7/22 20:18',likes:8,replies:[{id:1001,author:'匿名考生 #C03',body:'補充：複習時可以把採光與通風的比例整理在同一張表，比較不容易混淆。',date:'2026/7/22 20:31'}]},
  {id:102,qid:1,type:'觀念補充',author:'匿名考生 #B07',body:'建議不要只背 1/8，也要確認題目問的是「採光有效面積」還是「開口部有效通風面積」，兩者常被混合出題。',date:'2026/7/22 20:45',likes:5,replies:[]},
  {id:103,qid:4,type:'題目詳解',author:'匿名考生 #D21',body:'中央集中載重下，左右支承反力相同。彎矩由支承處的 0 線性增加至跨中，再對稱下降，因此最大彎矩在跨中。',date:'2026/7/22 19:52',likes:6,replies:[]}
]);
let currentQuiz = [], quizIndex = 0, quizScore = 0, currentDiscussionQuestion = 1;
let anonymousTag = store.get('anonymousTag', '匿名考生 #' + String.fromCharCode(65+Math.floor(Math.random()*26)) + String(Math.floor(Math.random()*100)).padStart(2,'0'));
store.set('anonymousTag', anonymousTag);

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function subjectName(id){return subjects.find(s=>s.id===id)?.name || id}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function go(page){$$('.page').forEach(p=>p.classList.remove('active'));$('#page-'+page).classList.add('active');$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));$('#pageTitle').textContent=$(`.nav-item[data-page="${page}"]`)?.textContent.trim()||'首頁';$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});renderAll()}

function initNav(){$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open')}
function fillSelects(){
  const subjectOptions='<option value="all">全部科目</option>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  $('#paperSubject').innerHTML=subjectOptions;$('#randomSubject').innerHTML=subjectOptions;
  $('#paperYear').innerHTML='<option value="all">全部年度</option>'+years.map(y=>`<option>${y}</option>`).join('');
  $('#randomFrom').innerHTML=[...years].reverse().map(y=>`<option>${y}</option>`).join('');
  $('#randomTo').innerHTML=years.map(y=>`<option>${y}</option>`).join('');
  $('#randomFrom').value='102';$('#randomTo').value='114';
  $('#discussionQuestion').innerHTML=questions.map(q=>`<option value="${q.id}">${q.year} 年｜${subjectName(q.subject)}｜第 ${q.id} 題</option>`).join('');
  $('#discussionQuestion').value=String(currentDiscussionQuestion);
}
function renderHome(){
  $('#subjectGrid').innerHTML=subjects.map(s=>{const count=questions.filter(q=>q.subject===s.id).length;return `<article class="subject-card"><div class="subject-symbol">${s.icon}</div><h3>${s.name}</h3><p>${s.desc}</p><footer><strong>${count} 題示範題</strong><button class="text-btn" onclick="openSubject('${s.id}')">瀏覽題庫 →</button></footer></article>`}).join('');
  $('#yearList').innerHTML=years.map(y=>`<button class="year-btn" onclick="openYear(${y})">${y} 年</button>`).join('');
}
window.openSubject=id=>{$('#paperSubject').value=id;go('papers')}; window.openYear=y=>{$('#paperYear').value=y;go('papers')};
function stats(){
  const answeredIds=Object.keys(answers); const correct=answeredIds.filter(id=>answers[id]?.correct).length; const acc=answeredIds.length?Math.round(correct/answeredIds.length*100):0;
  $('#statTotal').textContent=questions.length;$('#statAnswered').textContent=answeredIds.length;$('#statCompletion').textContent=`完成度 ${Math.round(answeredIds.length/questions.length*100)}%`;$('#statDifficult').textContent=difficult.length;$('#statAccuracy').textContent=acc+'%';
  $('#donutLabel').textContent=acc+'%';$('#accuracyDonut').style.background=`conic-gradient(var(--primary) ${acc}%,#e7edf5 ${acc}% 100%)`;$('#analysisAnswered').textContent=answeredIds.length+' 題';
}
function filteredPapers(){return questions.filter(q=>{
  const y=$('#paperYear').value,s=$('#paperSubject').value,st=$('#paperStatus').value,a=answers[q.id];
  return (y==='all'||q.year==y)&&(s==='all'||q.subject===s)&&(st==='all'||(st==='unanswered'&&!a)||(st==='answered'&&a)||(st==='wrong'&&a&&!a.correct));
})}
function rowHtml(q){const a=answers[q.id];return `<article class="question-row"><div><div class="question-meta"><span class="tag">${q.year} 年</span><span class="tag">${subjectName(q.subject)}</span><span class="tag">${q.topic}</span></div><h3>${q.text}</h3><p>${a?`最近作答：${a.correct?'答對':'答錯'}`:'尚未作答'}・${discussions.filter(d=>d.qid===q.id).length} 則匿名討論</p></div><div class="row-actions"><button class="star-btn ${difficult.includes(q.id)?'active':''}" onclick="toggleDifficult(${q.id})">★</button><button class="ghost-btn" onclick="openDiscussion(${q.id})">查看討論</button><button class="primary-btn" onclick="startSingle(${q.id})">開始作答</button></div></article>`}
function renderPapers(){const list=filteredPapers();$('#paperList').innerHTML=list.length?list.map(rowHtml).join(''):'<div class="empty-state"><h3>沒有符合條件的題目</h3></div>'}
['paperYear','paperSubject','paperStatus'].forEach(id=>document.addEventListener('change',e=>{if(e.target.id===id)renderPapers()}));
window.toggleDifficult=id=>{difficult=difficult.includes(id)?difficult.filter(x=>x!==id):[...difficult,id];store.set('difficult',difficult);renderAll();toast(difficult.includes(id)?'已加入難題':'已取消難題')};
window.startSingle=id=>{currentQuiz=[questions.find(q=>q.id===id)];quizIndex=0;quizScore=0;go('random');renderQuiz()};
window.openDiscussion=id=>{currentDiscussionQuestion=id;$('#discussionQuestion').value=String(id);go('community');renderCommunity()};
function renderDifficult(){const qs=questions.filter(q=>difficult.includes(q.id));$('#difficultList').innerHTML=qs.length?qs.map(rowHtml).join(''):'<div class="empty-state"><div class="empty-icon">☆</div><h3>尚未標記難題</h3><p>在題目旁點擊星號即可加入。</p></div>'}

function randomize(arr){return [...arr].sort(()=>Math.random()-.5)}
$('#randomForm').addEventListener('submit',e=>{e.preventDefault();let pool=questions.filter(q=>{
  const s=$('#randomSubject').value,from=+$ ('#randomFrom').value,to=+$ ('#randomTo').value;
  return (s==='all'||q.subject===s)&&q.year>=Math.min(from,to)&&q.year<=Math.max(from,to)&&(!$('#onlyUnanswered').checked||!answers[q.id])&&(!$('#onlyDifficult').checked||difficult.includes(q.id));
});
  currentQuiz=randomize(pool).slice(0,Math.min(+$ ('#randomCount').value,pool.length));quizIndex=0;quizScore=0;
  if(!currentQuiz.length){$('#quizArea').innerHTML='<div class="empty-state"><h3>找不到符合條件的題目</h3><p>請調整練習條件後再試一次。</p></div>';return}
  renderQuiz();
});
function renderQuiz(){
  const q=currentQuiz[quizIndex];if(!q){$('#quizArea').innerHTML='<div class="empty-state"><h3>尚未產生題目</h3></div>';return}
  $('#quizArea').innerHTML=`<div class="quiz-top"><div><span class="eyebrow">${subjectName(q.subject)}｜${q.year} 年</span><strong>第 ${quizIndex+1} / ${currentQuiz.length} 題</strong></div><button class="star-btn ${difficult.includes(q.id)?'active':''}" onclick="toggleDifficult(${q.id});renderQuiz()">★</button></div><div class="progress"><span style="width:${(quizIndex+1)/currentQuiz.length*100}%"></span></div><div class="quiz-question"><h2>${q.text}</h2><div class="options">${q.options.map((o,i)=>`<label class="option"><input type="radio" name="answer" value="${i}"><span>${String.fromCharCode(65+i)}. ${o}</span></label>`).join('')}</div><button class="primary-btn" id="submitAnswer">送出答案</button><button class="ghost-btn discussion-link" onclick="openDiscussion(${q.id})">查看本題匿名詳解與討論</button><div id="feedbackBox"></div><div class="quiz-nav"><button class="ghost-btn" id="prevQuestion" ${quizIndex===0?'disabled':''}>上一題</button><button class="ghost-btn" id="nextQuestion" ${quizIndex===currentQuiz.length-1?'disabled':''}>下一題</button></div></div>`;
  $('#submitAnswer').onclick=()=>submitAnswer(q);$('#prevQuestion').onclick=()=>{quizIndex--;renderQuiz()};$('#nextQuestion').onclick=()=>{quizIndex++;renderQuiz()};
}
function submitAnswer(q){const picked=$('input[name="answer"]:checked');if(!picked){toast('請先選擇答案');return}const val=+picked.value,correct=val===q.answer;answers[q.id]={selected:val,correct,date:new Date().toISOString()};store.set('answers',answers);history.unshift({id:Date.now(),qid:q.id,date:new Date().toLocaleString('zh-TW'),subject:q.subject,year:q.year,correct});history=history.slice(0,100);store.set('history',history);if(correct)quizScore++;
  $('#feedbackBox').innerHTML=`<div class="feedback ${correct?'correct':'wrong'}"><strong>${correct?'回答正確':'回答錯誤'}</strong><br>正確答案：${String.fromCharCode(65+q.answer)}. ${q.options[q.answer]}<br>${q.explanation}</div>`;stats();renderHistory();
}
function renderAnalysis(){const counts=subjects.map(s=>({name:s.name,count:questions.filter(q=>q.subject===s.id).length}));const max=Math.max(...counts.map(x=>x.count));$('#subjectBars').innerHTML=counts.map(x=>`<div class="bar-row"><span>${x.name}</span><div class="bar-track"><span style="width:${x.count/max*100}%"></span></div><strong>${x.count}</strong></div>`).join('');
  const topics=[['建築技術規則',12,'高頻'],['建築法',10,'高頻'],['消防避難',8,'中高'],['都市計畫法',6,'中頻'],['無障礙設計',5,'中頻']];$('#topicTable').innerHTML=topics.map(t=>`<div class="topic-row"><strong>${t[0]}</strong><span>${t[1]} 題</span><span class="tag">${t[2]}</span></div>`).join('')}
function renderCommunity(){
  const q=questions.find(x=>x.id===currentDiscussionQuestion) || questions[0];
  currentDiscussionQuestion=q.id;
  if($('#discussionQuestion')) $('#discussionQuestion').value=String(q.id);
  $('#anonymousPreview').textContent=anonymousTag;
  $('#communityQuestion').innerHTML=`<div class="question-meta"><span class="tag">${q.year} 年</span><span class="tag">${subjectName(q.subject)}</span><span class="tag">${q.topic}</span></div><h3>${q.text}</h3><div class="official-answer"><small>官方答案</small><strong>${String.fromCharCode(65+q.answer)}. ${q.options[q.answer]}</strong><p>${q.explanation}</p></div>`;
  const posts=discussions.filter(d=>d.qid===q.id).sort((a,b)=>b.likes-a.likes || b.id-a.id);
  $('#discussionCount').textContent=`${posts.length} 則討論`;
  $('#discussionList').innerHTML=posts.length?posts.map(d=>`<article class="discussion-card"><header><div><span class="discussion-type">${escapeHtml(d.type)}</span><strong>${escapeHtml(d.author)}</strong></div><time>${escapeHtml(d.date)}</time></header><p>${escapeHtml(d.body)}</p><div class="discussion-actions"><button class="text-btn" onclick="likeDiscussion(${d.id})">♡ 有幫助 ${d.likes}</button><button class="text-btn" onclick="toggleReply(${d.id})">回覆 ${d.replies?.length||0}</button><button class="text-btn muted-action" onclick="reportDiscussion(${d.id})">檢舉</button></div><div class="reply-list">${(d.replies||[]).map(r=>`<div class="reply"><div><strong>${escapeHtml(r.author)}</strong><time>${escapeHtml(r.date)}</time></div><p>${escapeHtml(r.body)}</p></div>`).join('')}</div><form class="reply-editor hidden" id="reply-${d.id}" onsubmit="addReply(event,${d.id})"><textarea rows="2" maxlength="500" placeholder="匿名回覆這則內容…"></textarea><div class="editor-actions"><small>將以 ${escapeHtml(anonymousTag)} 刊登</small><button class="primary-btn" type="submit">送出回覆</button></div></form></article>`).join(''):'<div class="empty-state compact"><div class="empty-icon">◎</div><h3>這題還沒有討論</h3><p>成為第一位匿名分享解法的人。</p></div>';
}
$('#discussionQuestion').addEventListener('change',e=>{currentDiscussionQuestion=+e.target.value;renderCommunity()});
$('#discussionForm').addEventListener('submit',e=>{e.preventDefault();const body=$('#discussionBody').value.trim();if(!body){toast('請先輸入投稿內容');return}discussions.unshift({id:Date.now(),qid:currentDiscussionQuestion,type:$('#discussionType').value,author:anonymousTag,body,date:new Date().toLocaleString('zh-TW'),likes:0,replies:[]});store.set('discussions',discussions);$('#discussionBody').value='';renderCommunity();renderPapers();toast('已匿名刊登')});
window.likeDiscussion=id=>{const post=discussions.find(d=>d.id===id);if(!post)return;post.likes=(post.likes||0)+1;store.set('discussions',discussions);renderCommunity()};
window.toggleReply=id=>{$('#reply-'+id)?.classList.toggle('hidden')};
window.addReply=(e,id)=>{e.preventDefault();const textarea=e.target.querySelector('textarea'),body=textarea.value.trim();if(!body){toast('請輸入回覆內容');return}const post=discussions.find(d=>d.id===id);if(!post)return;post.replies=post.replies||[];post.replies.push({id:Date.now(),author:anonymousTag,body,date:new Date().toLocaleString('zh-TW')});store.set('discussions',discussions);renderCommunity();toast('已匿名回覆')};
window.reportDiscussion=id=>toast('已收到檢舉，原型中不會實際送出');
function renderNotes(){if(!notes.length){$('#notesGrid').innerHTML='<div class="empty-state"><h3>尚無筆記</h3></div>';return}$('#notesGrid').innerHTML=notes.map(n=>`<article class="note-card"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p><footer><span>${n.date}</span><button class="text-btn" onclick="deleteNote(${n.id})">刪除</button></footer></article>`).join('')}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('#newNoteBtn').onclick=()=>$('#noteEditor').classList.remove('hidden');$('#cancelNote').onclick=()=>$('#noteEditor').classList.add('hidden');$('#saveNote').onclick=()=>{const t=$('#noteTitle').value.trim(),b=$('#noteBody').value.trim();if(!t||!b){toast('請填寫標題與內容');return}notes.unshift({id:Date.now(),title:t,body:b,date:new Date().toLocaleDateString('zh-TW')});store.set('notes',notes);$('#noteTitle').value='';$('#noteBody').value='';$('#noteEditor').classList.add('hidden');renderNotes();toast('筆記已儲存')};window.deleteNote=id=>{notes=notes.filter(n=>n.id!==id);store.set('notes',notes);renderNotes()};
function renderHistory(){if(!history.length){$('#historyBody').innerHTML='<tr><td colspan="5">尚無作答紀錄</td></tr>';return}$('#historyBody').innerHTML=history.map(h=>{const q=questions.find(x=>x.id===h.qid);return `<tr><td>${h.date}</td><td>${subjectName(h.subject)}</td><td>${h.year} 年</td><td>${q?.text||''}</td><td class="${h.correct?'result-ok':'result-bad'}">${h.correct?'答對':'答錯'}</td></tr>`}).join('')}
function settingsInit(){const dark=store.get('dark',false),large=store.get('large',false),collapsed=store.get('collapsed',false);document.body.classList.toggle('dark',dark);document.body.classList.toggle('large-text',large);$('#sidebar').classList.toggle('collapsed',collapsed);$('#darkModeSetting').checked=dark;$('#fontSizeSetting').value=large?'large':'normal';$('#collapseSetting').checked=collapsed}
function setDark(v){document.body.classList.toggle('dark',v);$('#darkModeSetting').checked=v;store.set('dark',v)}
$('#themeBtn').onclick=()=>setDark(!document.body.classList.contains('dark'));$('#darkModeSetting').onchange=e=>setDark(e.target.checked);$('#fontSizeSetting').onchange=e=>{const v=e.target.value==='large';document.body.classList.toggle('large-text',v);store.set('large',v)};$('#collapseSetting').onchange=e=>{document.querySelector('#sidebar').classList.toggle('collapsed',e.target.checked);store.set('collapsed',e.target.checked)};
$('#resetData').onclick=()=>{if(confirm('確定要清除所有示範資料嗎？')){['answers','difficult','history','notes','discussions','anonymousTag'].forEach(k=>localStorage.removeItem('arch_'+k));location.reload()}};
function renderAll(){renderHome();stats();renderPapers();renderDifficult();renderAnalysis();renderCommunity();renderNotes();renderHistory()}
initNav();fillSelects();settingsInit();renderAll();
