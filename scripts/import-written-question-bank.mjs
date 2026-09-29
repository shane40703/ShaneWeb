import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'WrittenQuestionInfo');
const bankRoot = path.join(root, 'public', 'question-bank');

const subjects = {
  environment: { directory: '環控', name: '建築環境控制' },
  structure: { directory: '結構', name: '建築結構' },
};

function parseYears(values) {
  if (values.length === 0) {
    return Array.from({ length: 15 }, (_, index) => 100 + index);
  }

  return [...new Set(values.flatMap((value) => {
    const range = /^(\d{3})-(\d{3})$/.exec(value);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    if (/^\d{3}$/.test(value)) return [Number(value)];
    throw new Error(`無效年度：${value}`);
  }))].sort((a, b) => a - b);
}

function environmentClassification(text) {
  if (/響度|八度音|分貝|餘響|吸音|聲學|噪音|隔音/.test(text)) {
    return { primaryCategory: '聲', topic: '音環境' };
  }
  if (/照明|色溫|照度|採光|眩光|光源|燈具/.test(text)) {
    return { primaryCategory: '光', topic: '照明' };
  }
  if (/換氣|通風|空氣品質|懸浮微粒|PM10|PM2\.5|污染物/.test(text)) {
    return { primaryCategory: '空氣', topic: '通風' };
  }
  if (/熱島|熱環境|結露|傳透熱|室溫|隔熱|遮陽|氣候|熱舒適/.test(text)) {
    return { primaryCategory: '熱', topic: '熱環境' };
  }
  if (/節能|能源|省水標章|綠建築|永續|人工濕地/.test(text)) {
    return { primaryCategory: '永續', topic: '綠建築與能源' };
  }
  if (/給水|排水|水壓|便器|廁所|衛生設備|熱水|污水/.test(text)) {
    return { primaryCategory: '設備', topic: '給排水' };
  }
  if (/電梯|昇降機/.test(text)) {
    return { primaryCategory: '設備', topic: '垂直運輸' };
  }
  if (/消防|滅火|防煙|火警|探測設備|防災/.test(text)) {
    return { primaryCategory: '設備', topic: '消防設備' };
  }
  if (/配線|電氣|智慧建築|變壓器|電力/.test(text)) {
    return { primaryCategory: '設備', topic: '電氣設備' };
  }
  return { primaryCategory: '設備', topic: '空調' };
}

function structureClassification(text) {
  if (/低碳|永續/.test(text)) {
    return { primaryCategory: '永續設計', topic: '低碳結構' };
  }
  if (/鋼筋混凝土|混凝土梁|混凝土柱|RC\b/.test(text)) {
    return { primaryCategory: '鋼筋混凝土', topic: '鋼筋混凝土' };
  }
  if (/鋼結構|鋼梁|鋼柱|鋼骨|銲接|焊接|螺栓/.test(text)) {
    return { primaryCategory: '鋼結構', topic: '鋼結構' };
  }
  if (/木結構|木構造/.test(text)) {
    return { primaryCategory: '木結構', topic: '木結構' };
  }
  if (/耐震|地震|韌性|層間位移|隔震|制震/.test(text)) {
    return { primaryCategory: '耐震', topic: '耐震設計' };
  }
  if (/基礎|樁|結構系統|薄殼|桁架|拱|懸索|吊索/.test(text)) {
    return {
      primaryCategory: '結構系統',
      topic: /基礎|樁/.test(text) ? '基礎設計' : '結構系統',
    };
  }
  return {
    primaryCategory: '力學',
    topic: /載重|風力|風壓/.test(text)
      ? '載重'
      : /材料|應力|應變|彈性|塑性/.test(text)
        ? '材料力學'
        : '結構力學',
  };
}

function classify(subject, text) {
  return subject === 'environment'
    ? environmentClassification(text)
    : structureClassification(text);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function importQuestion(year, subjectId, questionDirectory) {
  const sourceDirectory = path.join(sourceRoot, String(year), subjectId, questionDirectory);
  const metadata = await readJson(path.join(sourceDirectory, 'metadata.json'));
  const text = (await readFile(path.join(sourceDirectory, 'question.txt'), 'utf8')).trim();
  const questionNumber = Number(questionDirectory);
  const targetDirectory = path.join(
    bankRoot,
    subjects[subjectId].directory,
    String(year),
    `written-${String(questionNumber).padStart(2, '0')}`,
  );
  await mkdir(targetDirectory, { recursive: true });

  for (const entry of await readdir(targetDirectory)) {
    if (/^(?:question-\d+\.(?:txt|png|jpe?g|webp)|[A-D]\.txt)$/i.test(entry)) {
      await rm(path.join(targetDirectory, entry));
    }
  }
  await writeFile(path.join(targetDirectory, 'question-01.txt'), `${text}\n`, 'utf8');

  const imageDirectory = path.join(sourceDirectory, 'images');
  const imageFiles = (await readdir(imageDirectory))
    .filter((file) => !file.startsWith('.') && /\.(?:png|jpe?g|webp)$/i.test(file))
    .sort((left, right) => left.localeCompare(right, 'zh-Hant'));
  const images = {};
  for (const [index, image] of imageFiles.entries()) {
    const extension = path.extname(image).toLowerCase();
    const targetName = `question-${String(index + 2).padStart(2, '0')}${extension}`;
    await copyFile(path.join(imageDirectory, image), path.join(targetDirectory, targetName));
    images[targetName] = { alt: `${year} 年${subjects[subjectId].name}申論第 ${questionNumber} 題附圖` };
  }

  const existingFile = path.join(targetDirectory, 'meta.json');
  const existing = await isFile(existingFile) ? await readJson(existingFile) : {};
  const automatic = classify(subjectId, text);
  const classification = existing.format === 'written'
    ? {
        primaryCategory: existing.primaryCategory ?? automatic.primaryCategory,
        topic: existing.topic ?? automatic.topic,
        tags: existing.tags ?? [existing.topic ?? automatic.topic],
      }
    : { ...automatic, tags: [automatic.topic] };
  const meta = {
    format: 'written',
    ...classification,
    answerKey: { kind: 'written' },
    provenance: {
      kind: 'official',
      page: metadata.sourcePages[0],
    },
    ...(imageFiles.length > 0 ? { images } : {}),
  };
  await writeFile(existingFile, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return imageFiles.length;
}

async function main() {
  const years = parseYears(process.argv.slice(2));
  let questionCount = 0;
  let imageCount = 0;

  for (const year of years) {
    for (const subjectId of Object.keys(subjects)) {
      const subjectDirectory = path.join(sourceRoot, String(year), subjectId);
      const questionDirectories = (await readdir(subjectDirectory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && /^\d{3}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();
      for (const questionDirectory of questionDirectories) {
        imageCount += await importQuestion(year, subjectId, questionDirectory);
        questionCount += 1;
      }
      console.log(`${year} 年${subjects[subjectId].name}: ${questionDirectories.length} 題`);
    }
  }

  console.log(`完成匯入 ${questionCount} 題申論題、${imageCount} 張人工附圖。`);
}

await main();
