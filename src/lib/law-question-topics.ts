import type { Question } from '@/lib/types';

interface TopicRule {
  label: string;
  pattern: RegExp;
}

const topicRules: readonly TopicRule[] = [
  { label: '國土計畫擬定與功能分區', pattern: /國土計畫|國土功能分區|國土復育|國土永續發展基金|都會區域/ },
  { label: '都市更新權利變換', pattern: /權利變換|權利價值|共同負擔|更新後分配/ },
  { label: '都市更新實施與審議', pattern: /都市更新|更新單元|更新地區|事業計畫|實施者/ },
  { label: '防火區劃與防火間隔', pattern: /防火區劃|防火間隔|防火牆|防火門|防火捲門/ },
  { label: '防火構造與耐火時效', pattern: /防火構造|耐火構造|耐火時效|不燃材料|耐燃材料/ },
  { label: '建築物隔音構造', pattern: /隔音構造|隔音性能|分戶牆|樓板衝擊音|空氣音隔音/ },
  { label: '建築物公共安全檢查', pattern: /公共安全檢查|定期.*檢查簽證|檢查簽證.*申報|專業檢查/ },
  { label: '室內裝修管理', pattern: /室內裝修|裝修業|裝修專業技術人員|室內裝修從業者/ },
  { label: '招牌廣告與樹立廣告', pattern: /招牌廣告|樹立廣告|廣告物/ },
  { label: '直通樓梯與避難設施', pattern: /直通樓梯|安全梯|特別安全梯|避難層|步行距離|避難設施/ },
  { label: '緊急進口與救災空間', pattern: /緊急進口|緊急昇降機|救災活動空間|消防車輛救災/ },
  { label: '防火避難綜合檢討', pattern: /防火避難綜合檢討|性能設計|煙控|排煙設備/ },
  { label: '無障礙通路與設施', pattern: /無障礙|行動不便|輪椅|引導設施|點字/ },
  { label: '停車空間與裝卸車位', pattern: /停車空間|停車位|裝卸車位|停車場|汽車昇降機/ },
  { label: '防空避難設備', pattern: /防空避難/ },
  { label: '建築物採光與通風', pattern: /採光|有效採光|通風|開口面積|居室.*窗/ },
  { label: '建築物高度與日照退縮', pattern: /建築物高度|高度限制|日照|斜率|退縮|道路斜線|陰影/ },
  { label: '山坡地建築與開發', pattern: /山坡地|平均坡度|坡度分析|水土保持/ },
  { label: '開挖與擋土安全', pattern: /挖土|開挖|擋土|地下開挖/ },
  { label: '建蔽率與容積率', pattern: /建蔽率|容積率|容積移轉|容積獎勵|樓地板面積.*容積/ },
  { label: '建築基地與法定空地', pattern: /建築基地|法定空地|基地面積|基地境界|私設通路|現有巷道/ },
  { label: '建築面積與樓地板面積', pattern: /建築面積|樓地板面積|陽臺|屋簷|免計.*面積/ },
  { label: '建造執照與使用執照', pattern: /建造執照|使用執照|雜項執照|拆除執照|執照申請/ },
  { label: '建築物變更使用', pattern: /變更使用|用途變更|使用類組|免辦變更/ },
  { label: '違章建築與強制拆除', pattern: /違章建築|違建|強制拆除|停止使用|補辦手續/ },
  { label: '建築法罰則與處罰', pattern: /處罰|罰鍰|罰則|連續處罰|勒令停工|刑責/ },
  { label: '建築師業務與簽證', pattern: /建築師.*簽證|簽證負責|建築師業務|開業證書|事務所/ },
  { label: '建築師懲戒與責任', pattern: /建築師.*懲戒|懲戒委員會|撤銷.*建築師|停止執行業務/ },
  { label: '建築師公會與執業倖理', pattern: /建築師公會|建築師.*兼任|建築師.*兼營|建築師.*獎勵|襄助辦理/ },
  { label: '公寓大廈區分所有權', pattern: /區分所有權|區分所有人會議|專有部分|共用部分|約定專用/ },
  { label: '公寓大廈管理委員會', pattern: /管理委員會|管理負責人|管理委員|規約|公共基金/ },
  { label: '公寓大廈管理服務人', pattern: /管理維護公司|管理服務人|公寓大廈管理維護/ },
  { label: '都市計畫土地使用分區', pattern: /土地使用分區|使用分區管制|都市計畫.*分區|住宅區|商業區|工業區/ },
  { label: '都市計畫變更與審議', pattern: /都市計畫.*變更|都市計畫委員會|主要計畫|細部計畫/ },
  { label: '徵收、補償與市地重劃', pattern: /徵收|補償地價|市地重劃|區段徵收|抵價地/ },
  { label: '非都市土地使用管制', pattern: /非都市土地|使用地編定|山坡地保育區|特定農業區/ },
  { label: '政府採購招標與決標', pattern: /招標|決標|投標|底價|最有利標|押標金/ },
  { label: '政府採購履約與爭議', pattern: /履約|採購申訴|調解|驗收|保固|契約變更/ },
  { label: '營造業分類與承攬', pattern: /綜合營造業|專業營造業|土木包工業|承攬工程|承攬限額/ },
  { label: '工地主任與專任工程人員', pattern: /工地主任|專任工程人員|技師.*簽章|施工計畫書/ },
  { label: '消防安全設備', pattern: /消防安全設備|自動撒水|火警自動警報|室內消防栓|滅火器/ },
  { label: '古蹟與歷史建築保存', pattern: /古蹟|歷史建築|文化資產|保存區|修復再利用/ },
  { label: '住宅補貼與社會住宅', pattern: /社會住宅|住宅補貼|租金補貼|住宅法人/ },
  { label: '國家公園土地與建築管制', pattern: /國家公園|一般管制區|遊憩區|史蹟保存區/ },
  { label: '農業用地與農舍', pattern: /農舍|農業用地|農業設施|集村興建/ },
  { label: '建築物結構與耐震設計', pattern: /耐震|結構安全|結構計算|耐震能力|震區/ },
  { label: '建築物耐風設計', pattern: /耐風|風力係數|設計風力/ },
  { label: '鋼骨鋼筋混凝土構造', pattern: /鋼骨鋼筋混凝土|鋼骨鋼筋.*構造/ },
  { label: '綠建築與節能設計', pattern: /綠建築|綠建材|建築節能|節約能源|外殼耗能|再生能源|雨水貯留/ },
  { label: '法規位階與行政程序', pattern: /中央法規標準法|法規適用|法規命令|行政規則|許可案件.*適用法規/ },
  { label: '建築物設備與管線', pattern: /昇降機|給水|排水|污水|電氣設備|避雷設備|燃氣設備/ },
];

function searchableText(question: Pick<Question, 'text' | 'options'>) {
  return `${question.text}\n${question.options.join('\n')}`.replace(/\s+/g, '');
}

export function getLawQuestionFineTopic(question: Question) {
  if (question.subject !== 'law') return null;
  const source = searchableText(question);
  return topicRules.find((rule) => rule.pattern.test(source))?.label ?? null;
}

export function getSimilarLawQuestions(
  question: Question,
  questions: readonly Question[],
  limit = 6,
) {
  const topic = getLawQuestionFineTopic(question);
  if (!topic) return { topic: null, questions: [] as Question[] };
  return {
    topic,
    questions: questions
      .filter(
        (candidate) =>
          candidate.id !== question.id &&
          candidate.subject === 'law' &&
          getLawQuestionFineTopic(candidate) === topic,
      )
      .sort(
        (left, right) =>
          Math.abs(left.year - question.year) - Math.abs(right.year - question.year) ||
          right.year - left.year ||
          left.questionNumber - right.questionNumber,
      )
      .slice(0, limit),
  };
}
