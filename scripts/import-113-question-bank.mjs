import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const answerRoot = path.join(projectRoot, 'AnswersInfo');
const targetRoot = path.join(projectRoot, 'public', 'question-bank');
const answerLabels = ['A', 'B', 'C', 'D'];

const subjects = [
  {
    source: 'regulations',
    directory: '法規',
    questionCount: 80,
    paperCode: '1801',
    officialName: '營建法規與實務',
    subjectCode: '0101',
  },
  {
    source: 'environment',
    directory: '環控',
    questionCount: 40,
    paperCode: '4801',
    officialName: '建築環境控制',
    subjectCode: '0104',
  },
  {
    source: 'construction',
    directory: '構造',
    questionCount: 80,
    paperCode: '3801',
    officialName: '建築構造與施工',
    subjectCode: '0103',
  },
  {
    source: 'structure',
    directory: '結構',
    questionCount: 40,
    paperCode: '2801',
    officialName: '建築結構',
    subjectCode: '0102',
  },
];

const knownLaws = [
  '建築物無障礙設施設計規範',
  '都市危險及老舊建築物加速重建條例施行細則',
  '都市危險及老舊建築物建築容積獎勵辦法',
  '實施區域計畫地區建築管理辦法',
  '原有合法建築物公共安全改善辦法',
  '建築物部分使用執照核發辦法',
  '都市計畫容積移轉實施辦法',
  '採購評選委員會組織準則',
  '農業用地興建農舍辦法',
  '建築物室內裝修管理辦法',
  '各類場所消防安全設備設置標準',
  '公寓大廈管理條例',
  '文化資產保存法',
  '中央法規標準法',
  '違章建築處理辦法',
  '都市更新條例',
  '都市計畫法',
  '國土計畫法',
  '區域計畫法',
  '國家公園法',
  '政府採購法',
  '建築技術規則',
  '建築師法',
  '營造業法',
  '住宅法施行細則',
  '住宅法',
  '建築法',
];

function lawClassification(text) {
  const relatedLaws = knownLaws.filter((law) => text.includes(law));
  if (!relatedLaws.length) relatedLaws.push('其他營建法規');

  if (text.includes('無障礙')) {
    return {
      primaryCategory: '無障礙設施設計規範',
      topic: '無障礙設計',
      relatedLaws,
    };
  }
  if (text.includes('建築技術規則')) {
    return {
      primaryCategory: '建築技術規則',
      topic: '建築技術規則',
      relatedLaws,
    };
  }
  if (
    /都市計畫|都市更新|國土計畫|區域計畫|非都市土地|農舍/.test(
      text,
    )
  ) {
    return {
      primaryCategory: '都市計畫法',
      topic: text.includes('都市更新')
        ? '都市更新法規'
        : text.includes('非都市') || text.includes('農舍')
          ? '非都市土地'
          : '國土與區域計畫',
      relatedLaws,
    };
  }
  if (text.includes('公寓大廈')) {
    return {
      primaryCategory: '公寓大廈管理條例',
      topic: '公寓大廈管理',
      relatedLaws,
    };
  }
  if (text.includes('營造業')) {
    return {
      primaryCategory: '營造業法',
      topic: '營造業法',
      relatedLaws,
    };
  }
  if (/政府採購|採購評選/.test(text)) {
    return {
      primaryCategory: '政府採購法',
      topic: '政府採購法',
      relatedLaws,
    };
  }
  if (/消防|防煙/.test(text)) {
    return {
      primaryCategory: '消防法規',
      topic: '消防避難',
      relatedLaws,
    };
  }
  if (/建築法|建築師|室內裝修|建築物部分使用|公共安全/.test(text)) {
    return {
      primaryCategory: '建築法',
      topic: text.includes('建築師') ? '建築師法' : '建築管理法規',
      relatedLaws,
    };
  }
  return {
    primaryCategory: '其他營建法規',
    topic: text.includes('住宅')
      ? '住宅法'
      : text.includes('文化資產')
        ? '文化資產保存法'
        : text.includes('國家公園')
          ? '國家公園法'
          : text.includes('農舍')
            ? '農舍法規'
            : '法規位階',
    relatedLaws,
  };
}

function environmentClassification(text) {
  if (/響度|八度音|分貝|餘響|吸音|聲學|噪音/.test(text)) {
    return { primaryCategory: '聲', topic: '音環境' };
  }
  if (/照明|色溫|照度|採光|光電/.test(text)) {
    return text.includes('光電')
      ? { primaryCategory: '永續', topic: '綠建築與能源' }
      : { primaryCategory: '光', topic: '照明' };
  }
  if (/換氣|通風|空氣品質|懸浮微粒|PM10|PM2\\.5/.test(text)) {
    return { primaryCategory: '空氣', topic: '通風' };
  }
  if (/熱島|熱環境|結露|傳透熱|室溫|隔熱|遮陽|氣候/.test(text)) {
    return { primaryCategory: '熱', topic: '熱環境' };
  }
  if (/節能|能源|省水標章|綠建築|永續/.test(text)) {
    return { primaryCategory: '永續', topic: '綠建築與能源' };
  }
  if (/給水|水壓|便器|廁所|衛生設備|熱水/.test(text)) {
    return { primaryCategory: '設備', topic: '給排水' };
  }
  if (/電梯|昇降機/.test(text)) {
    return { primaryCategory: '設備', topic: '垂直運輸' };
  }
  if (/消防|滅火器|防煙|防災/.test(text)) {
    return { primaryCategory: '設備', topic: '消防設備' };
  }
  if (/配線|電氣|智慧建築/.test(text)) {
    return { primaryCategory: '設備', topic: '電氣設備' };
  }
  return { primaryCategory: '設備', topic: '空調' };
}

function constructionClassification(text) {
  if (/防水|止水|漏水|屋頂/.test(text)) {
    return {
      primaryCategory: '防水工程',
      topic: text.includes('屋頂') ? '屋頂防水' : '防水工程',
    };
  }
  if (/BIM|品質|安全|成本|進度|工地管理|查核|估驗/.test(text)) {
    return {
      primaryCategory: '工程管理',
      topic: text.includes('BIM')
        ? 'BIM'
        : /成本|進度|估驗/.test(text)
          ? '進度與成本'
          : '品質與安全',
    };
  }
  if (/低碳|綠建築|基地保水|景觀|永續/.test(text)) {
    return {
      primaryCategory: '永續建築',
      topic: /基地|景觀/.test(text) ? '基地與景觀' : '低碳與綠建築',
    };
  }
  if (/施工|粉刷|吊裝|澆置|模板|開挖|打樁|放樣/.test(text)) {
    return {
      primaryCategory: '施工程序',
      topic: text.includes('混凝土')
        ? '混凝土施工'
        : text.includes('鋼')
          ? '鋼構施工'
          : /粉刷|裝修/.test(text)
            ? '裝修施工'
            : '工地施工',
    };
  }
  if (/木構|木造|集成材/.test(text)) {
    return { primaryCategory: '構法', topic: '木構造' };
  }
  if (/砌體|磚|隔間/.test(text)) {
    return { primaryCategory: '構法', topic: '砌體與隔間' };
  }
  if (/基礎|樁|地盤/.test(text)) {
    return { primaryCategory: '構法', topic: '基礎工程' };
  }
  if (/帷幕牆|外牆/.test(text)) {
    return { primaryCategory: '構法', topic: '帷幕牆與外牆' };
  }
  if (/鋼構|鋼骨|複合構造/.test(text)) {
    return { primaryCategory: '構法', topic: '鋼構與複合構造' };
  }
  if (/防火|隔音/.test(text)) {
    return { primaryCategory: '構法', topic: '防火與隔音' };
  }
  return {
    primaryCategory: '材料',
    topic: /混凝土|水泥|骨材/.test(text)
      ? '混凝土材料'
      : /木材|木質/.test(text)
        ? '木質材料'
        : /金屬|鋼材|鋁/.test(text)
          ? '金屬材料'
          : /綠建材/.test(text)
            ? '綠建材'
            : '材料',
  };
}

function structureClassification(text) {
  if (/低碳|永續/.test(text)) {
    return { primaryCategory: '永續設計', topic: '低碳結構' };
  }
  if (/鋼筋混凝土|混凝土梁|混凝土柱|RC /.test(text)) {
    return { primaryCategory: '鋼筋混凝土', topic: '鋼筋混凝土' };
  }
  if (/鋼結構|鋼梁|鋼柱|鋼骨|銲接|螺栓/.test(text)) {
    return { primaryCategory: '鋼結構', topic: '鋼結構' };
  }
  if (/木結構|木構造/.test(text)) {
    return { primaryCategory: '木結構', topic: '木結構' };
  }
  if (/耐震|地震|韌性|層間位移/.test(text)) {
    return { primaryCategory: '耐震', topic: '耐震設計' };
  }
  if (/基礎|樁|結構系統|薄殼|桁架|拱/.test(text)) {
    return {
      primaryCategory: '結構系統',
      topic: /基礎|樁/.test(text) ? '基礎設計' : '結構系統',
    };
  }
  return {
    primaryCategory: '力學',
    topic: /載重|風力|風壓/.test(text)
      ? '載重'
      : /材料|應力|應變|彈性/.test(text)
        ? '材料力學'
        : '結構力學',
  };
}

function classify(source, text) {
  if (source === 'regulations') return lawClassification(text);
  if (source === 'environment') return environmentClassification(text);
  if (source === 'construction') return constructionClassification(text);
  return structureClassification(text);
}

function parseAnswers(content, expectedCount) {
  const entries = content.trim().split(/\r?\n/).map((line) => {
    const match = /^(\d+)=([A-D]+)$/.exec(line.trim());
    if (!match) throw new Error(`無法解析答案：${line}`);
    return [Number(match[1]), match[2]];
  });
  if (entries.length !== expectedCount) {
    throw new Error(`答案數量 ${entries.length}，預期 ${expectedCount}`);
  }
  return new Map(entries);
}

function parseQuestion(content, expectedNumber) {
  const lines = content.replaceAll('\r\n', '\n').trim().split('\n');
  const optionIndexes = answerLabels.map((label) =>
    lines.findIndex((line) => new RegExp(`^${label}\\.\\s*`).test(line)),
  );
  if (optionIndexes.some((index) => index < 0)) {
    throw new Error(`第 ${expectedNumber} 題缺少完整選項`);
  }

  const questionLines = lines.slice(0, optionIndexes[0]);
  const hasQuestionImage = questionLines.some((line) =>
    line.startsWith('[圖片：'),
  );
  const prompt = questionLines
    .slice(0, optionIndexes[0])
    .filter((line) => line.trim() && !line.startsWith('[圖片：'))
    .join(' ')
    .replace(new RegExp(`^${expectedNumber}\\.\\s*`), '')
    .trim();
  const options = optionIndexes.map((start, index) => {
    const end = optionIndexes[index + 1] ?? lines.length;
    const option = lines
      .slice(start, end)
      .join(' ')
      .replace(/^[A-D]\.\s*/, '')
      .trim();
    return option || `附圖選項（${answerLabels[index]}）`;
  });
  if ((!prompt && !hasQuestionImage) || options.some((option) => !option)) {
    throw new Error(`第 ${expectedNumber} 題題幹或選項為空`);
  }
  return { prompt: prompt || '請依附圖作答。', options };
}

function paperMeta(year, subject) {
  const base =
    `https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?` +
    `c=801&code=${year}180&q=1&s=${subject.subjectCode}`;
  return {
    status: 'official-complete',
    paperCode: subject.paperCode,
    officialName: subject.officialName,
    totalQuestions: subject.questionCount,
    questionUrl: `${base}&t=Q`,
    answerUrl: `${base}&t=S`,
  };
}

async function readExistingClassification(questionTargetRoot) {
  try {
    const existing = JSON.parse(
      await readFile(path.join(questionTargetRoot, 'meta.json'), 'utf8'),
    );
    return Object.fromEntries(
      ['primaryCategory', 'topic', 'tags', 'relatedLaws']
        .filter((key) => key in existing)
        .map((key) => [key, existing[key]]),
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function removePreviousQuestionImages(questionTargetRoot) {
  try {
    const entries = await readdir(questionTargetRoot);
    await Promise.all(
      entries
        .filter((fileName) => /^question-\d+\.(png|jpe?g|webp)$/i.test(fileName))
        .map((fileName) => rm(path.join(questionTargetRoot, fileName))),
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function importSubject(year, subject) {
  const sourceRoot = path.join(projectRoot, 'QuestionInfo', String(year));
  const subjectSourceRoot = path.join(sourceRoot, subject.source);
  const subjectTargetRoot = path.join(
    targetRoot,
    subject.directory,
    String(year),
  );
  const answers = parseAnswers(
    await readFile(
      path.join(answerRoot, subject.source, `${year}.txt`),
      'utf8',
    ),
    subject.questionCount,
  );

  await mkdir(subjectTargetRoot, { recursive: true });
  await writeFile(
    path.join(subjectTargetRoot, 'paper.json'),
    `${JSON.stringify(paperMeta(year, subject), null, 2)}\n`,
  );

  for (
    let questionNumber = 1;
    questionNumber <= subject.questionCount;
    questionNumber += 1
  ) {
    const sourceNumber = String(questionNumber).padStart(3, '0');
    const targetNumber = String(questionNumber).padStart(2, '0');
    const questionSourceRoot = path.join(subjectSourceRoot, sourceNumber);
    const questionTargetRoot = path.join(subjectTargetRoot, targetNumber);
    const sourceMetadata = JSON.parse(
      await readFile(path.join(questionSourceRoot, 'metadata.json'), 'utf8'),
    );
    const { prompt, options } = parseQuestion(
      await readFile(path.join(questionSourceRoot, 'question.txt'), 'utf8'),
      questionNumber,
    );
    const answer = answers.get(questionNumber);
    if (!answer) throw new Error(`${subject.source} 第 ${questionNumber} 題缺少答案`);

    const imageDirectory = path.join(questionSourceRoot, 'images');
    const imageFiles = (await readdir(imageDirectory)).filter(
      (fileName) => !fileName.startsWith('.'),
    );
    if (imageFiles.length > 1) {
      throw new Error(`${subject.source} 第 ${questionNumber} 題含多張來源圖片`);
    }
    const imageFileName = imageFiles[0];
    const targetImageName = imageFileName
      ? `question-02${path.extname(imageFileName).toLowerCase()}`
      : null;
    const classification = classify(subject.source, prompt);
    const existingClassification = await readExistingClassification(
      questionTargetRoot,
    );
    const metadata = {
      ...classification,
      ...existingClassification,
      tags: existingClassification.tags ?? [classification.topic],
      answerKey:
        answer === 'ABCD'
          ? { kind: 'all-credit' }
          : { kind: 'accepted', options: [...answer] },
      provenance: {
        kind: 'official',
        page: sourceMetadata.sourcePages?.[0] ?? 1,
      },
      ...(targetImageName
        ? {
            images: {
              [targetImageName]: {
                alt: `第 ${questionNumber} 題${
                  sourceMetadata.imageReasons?.join('、') || '題目'
                }附圖`,
              },
            },
          }
        : {}),
    };

    await mkdir(questionTargetRoot, { recursive: true });
    await removePreviousQuestionImages(questionTargetRoot);
    await writeFile(path.join(questionTargetRoot, 'question-01.txt'), `${prompt}\n`);
    await Promise.all(
      options.map((option, index) =>
        writeFile(
          path.join(questionTargetRoot, `${answerLabels[index]}.txt`),
          `${option}\n`,
        ),
      ),
    );
    await writeFile(
      path.join(questionTargetRoot, 'meta.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    if (imageFileName && targetImageName) {
      await copyFile(
        path.join(imageDirectory, imageFileName),
        path.join(questionTargetRoot, targetImageName),
      );
    }
  }
}

const years = Array.from({ length: 13 }, (_, index) => 102 + index);

for (const year of years) {
  for (const subject of subjects) {
    await importSubject(year, subject);
  }
}

console.log(
  `已匯入 ${years[0]}～${years.at(-1)} 年 ${years.length * subjects.reduce(
    (total, subject) => total + subject.questionCount,
    0,
  )} 題正式題庫。`,
);
