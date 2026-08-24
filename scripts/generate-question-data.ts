import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { subjects, years } from '@/question-bank/catalog';
import { loadSubjectQuestions } from '@/server/question-bank.server';

const outputRoot = path.join(process.cwd(), 'public', 'question-data');

async function main() {
  for (const subject of subjects) {
    const outputDirectory = path.join(outputRoot, subject.id);
    await mkdir(outputDirectory, { recursive: true });
    for (const year of years) {
      const questions = await loadSubjectQuestions(subject.id, year);
      await writeFile(
        path.join(outputDirectory, `${year}.json`),
        JSON.stringify(questions),
        'utf8',
      );
    }
  }

  console.log(`Generated ${subjects.length * years.length} question data files.`);
}

void main();
