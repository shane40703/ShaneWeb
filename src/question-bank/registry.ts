import type {
  PaperMeta,
  PrimaryCategory,
  QuestionMeta,
  SubjectId,
} from '@/question-bank/schema';
import law11401 from '@/question-bank/law/114/01/meta';
import law11301 from '@/question-bank/law/113/01/meta';
import law11201 from '@/question-bank/law/112/01/meta';
import law11101 from '@/question-bank/law/111/01/meta';
import law10801 from '@/question-bank/law/108/01/meta';
import env11401 from '@/question-bank/env/114/01/meta';
import env11301 from '@/question-bank/env/113/01/meta';
import env11201 from '@/question-bank/env/112/01/meta';
import env11101 from '@/question-bank/env/111/01/meta';
import env10601 from '@/question-bank/env/106/01/meta';
import construction11401 from '@/question-bank/construction/114/01/meta';
import construction11449 from '@/question-bank/construction/114/49/meta';
import construction11301 from '@/question-bank/construction/113/01/meta';
import construction11201 from '@/question-bank/construction/112/01/meta';
import construction11001 from '@/question-bank/construction/110/01/meta';
import construction10401 from '@/question-bank/construction/104/01/meta';
import structure11401 from '@/question-bank/structure/114/01/meta';
import structure11301 from '@/question-bank/structure/113/01/meta';
import structure11201 from '@/question-bank/structure/112/01/meta';
import structure11001 from '@/question-bank/structure/110/01/meta';
import structure10201 from '@/question-bank/structure/102/01/meta';
import law114Paper from '@/question-bank/law/114/paper';
import construction114Paper from '@/question-bank/construction/114/paper';

function registerQuestion<
  const S extends SubjectId,
  const C extends PrimaryCategory<S>,
>(subject: S, year: number, questionNumber: number, meta: QuestionMeta<S, C>) {
  return { subject, year, questionNumber, meta } as const;
}

function registerPaper<const S extends SubjectId>(
  subject: S,
  year: number,
  meta: PaperMeta,
) {
  return { subject, year, meta } as const;
}

export const questionRegistry = [
  registerQuestion('law', 114, 1, law11401),
  registerQuestion('law', 113, 1, law11301),
  registerQuestion('law', 112, 1, law11201),
  registerQuestion('law', 111, 1, law11101),
  registerQuestion('law', 108, 1, law10801),
  registerQuestion('env', 114, 1, env11401),
  registerQuestion('env', 113, 1, env11301),
  registerQuestion('env', 112, 1, env11201),
  registerQuestion('env', 111, 1, env11101),
  registerQuestion('env', 106, 1, env10601),
  registerQuestion('construction', 114, 1, construction11401),
  registerQuestion('construction', 114, 49, construction11449),
  registerQuestion('construction', 113, 1, construction11301),
  registerQuestion('construction', 112, 1, construction11201),
  registerQuestion('construction', 110, 1, construction11001),
  registerQuestion('construction', 104, 1, construction10401),
  registerQuestion('structure', 114, 1, structure11401),
  registerQuestion('structure', 113, 1, structure11301),
  registerQuestion('structure', 112, 1, structure11201),
  registerQuestion('structure', 110, 1, structure11001),
  registerQuestion('structure', 102, 1, structure10201),
] as const;

export const paperRegistry = [
  registerPaper('law', 114, law114Paper),
  registerPaper('construction', 114, construction114Paper),
] as const;

export type QuestionRegistryEntry = (typeof questionRegistry)[number];
