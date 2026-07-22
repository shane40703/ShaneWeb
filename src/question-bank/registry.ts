import type {
  PaperMeta,
  PrimaryCategory,
  QuestionMeta,
  SubjectId,
} from '@/question-bank/schema';
import law11401 from '@/question-bank/法規/114/01/meta';
import law11402 from '@/question-bank/法規/114/02/meta';
import law11403 from '@/question-bank/法規/114/03/meta';
import law11404 from '@/question-bank/法規/114/04/meta';
import law11405 from '@/question-bank/法規/114/05/meta';
import law11406 from '@/question-bank/法規/114/06/meta';
import law11407 from '@/question-bank/法規/114/07/meta';
import law11408 from '@/question-bank/法規/114/08/meta';
import law11409 from '@/question-bank/法規/114/09/meta';
import law11410 from '@/question-bank/法規/114/10/meta';
import law11411 from '@/question-bank/法規/114/11/meta';
import law11412 from '@/question-bank/法規/114/12/meta';
import law11413 from '@/question-bank/法規/114/13/meta';
import law11414 from '@/question-bank/法規/114/14/meta';
import law11415 from '@/question-bank/法規/114/15/meta';
import law11416 from '@/question-bank/法規/114/16/meta';
import law11417 from '@/question-bank/法規/114/17/meta';
import law11418 from '@/question-bank/法規/114/18/meta';
import law11419 from '@/question-bank/法規/114/19/meta';
import law11420 from '@/question-bank/法規/114/20/meta';
import law11421 from '@/question-bank/法規/114/21/meta';
import law11422 from '@/question-bank/法規/114/22/meta';
import law11423 from '@/question-bank/法規/114/23/meta';
import law11424 from '@/question-bank/法規/114/24/meta';
import law11425 from '@/question-bank/法規/114/25/meta';
import law11426 from '@/question-bank/法規/114/26/meta';
import law11427 from '@/question-bank/法規/114/27/meta';
import law11428 from '@/question-bank/法規/114/28/meta';
import law11429 from '@/question-bank/法規/114/29/meta';
import law11430 from '@/question-bank/法規/114/30/meta';
import law11431 from '@/question-bank/法規/114/31/meta';
import law11432 from '@/question-bank/法規/114/32/meta';
import law11433 from '@/question-bank/法規/114/33/meta';
import law11434 from '@/question-bank/法規/114/34/meta';
import law11435 from '@/question-bank/法規/114/35/meta';
import law11436 from '@/question-bank/法規/114/36/meta';
import law11437 from '@/question-bank/法規/114/37/meta';
import law11438 from '@/question-bank/法規/114/38/meta';
import law11439 from '@/question-bank/法規/114/39/meta';
import law11440 from '@/question-bank/法規/114/40/meta';
import law11441 from '@/question-bank/法規/114/41/meta';
import law11442 from '@/question-bank/法規/114/42/meta';
import law11443 from '@/question-bank/法規/114/43/meta';
import law11444 from '@/question-bank/法規/114/44/meta';
import law11445 from '@/question-bank/法規/114/45/meta';
import law11446 from '@/question-bank/法規/114/46/meta';
import law11447 from '@/question-bank/法規/114/47/meta';
import law11448 from '@/question-bank/法規/114/48/meta';
import law11449 from '@/question-bank/法規/114/49/meta';
import law11450 from '@/question-bank/法規/114/50/meta';
import law11451 from '@/question-bank/法規/114/51/meta';
import law11452 from '@/question-bank/法規/114/52/meta';
import law11453 from '@/question-bank/法規/114/53/meta';
import law11454 from '@/question-bank/法規/114/54/meta';
import law11455 from '@/question-bank/法規/114/55/meta';
import law11456 from '@/question-bank/法規/114/56/meta';
import law11457 from '@/question-bank/法規/114/57/meta';
import law11458 from '@/question-bank/法規/114/58/meta';
import law11459 from '@/question-bank/法規/114/59/meta';
import law11460 from '@/question-bank/法規/114/60/meta';
import law11461 from '@/question-bank/法規/114/61/meta';
import law11462 from '@/question-bank/法規/114/62/meta';
import law11463 from '@/question-bank/法規/114/63/meta';
import law11464 from '@/question-bank/法規/114/64/meta';
import law11465 from '@/question-bank/法規/114/65/meta';
import law11466 from '@/question-bank/法規/114/66/meta';
import law11467 from '@/question-bank/法規/114/67/meta';
import law11468 from '@/question-bank/法規/114/68/meta';
import law11469 from '@/question-bank/法規/114/69/meta';
import law11470 from '@/question-bank/法規/114/70/meta';
import law11471 from '@/question-bank/法規/114/71/meta';
import law11472 from '@/question-bank/法規/114/72/meta';
import law11473 from '@/question-bank/法規/114/73/meta';
import law11474 from '@/question-bank/法規/114/74/meta';
import law11475 from '@/question-bank/法規/114/75/meta';
import law11476 from '@/question-bank/法規/114/76/meta';
import law11477 from '@/question-bank/法規/114/77/meta';
import law11478 from '@/question-bank/法規/114/78/meta';
import law11479 from '@/question-bank/法規/114/79/meta';
import law11480 from '@/question-bank/法規/114/80/meta';
import law11301 from '@/question-bank/法規/113/01/meta';
import law11201 from '@/question-bank/法規/112/01/meta';
import law11101 from '@/question-bank/法規/111/01/meta';
import law10801 from '@/question-bank/法規/108/01/meta';
import env11401 from '@/question-bank/環控/114/01/meta';
import env11301 from '@/question-bank/環控/113/01/meta';
import env11201 from '@/question-bank/環控/112/01/meta';
import env11101 from '@/question-bank/環控/111/01/meta';
import env10601 from '@/question-bank/環控/106/01/meta';
import construction11401 from '@/question-bank/構造/114/01/meta';
import construction11449 from '@/question-bank/構造/114/49/meta';
import construction11301 from '@/question-bank/構造/113/01/meta';
import construction11201 from '@/question-bank/構造/112/01/meta';
import construction11001 from '@/question-bank/構造/110/01/meta';
import construction10401 from '@/question-bank/構造/104/01/meta';
import structure11401 from '@/question-bank/結構/114/01/meta';
import structure11301 from '@/question-bank/結構/113/01/meta';
import structure11201 from '@/question-bank/結構/112/01/meta';
import structure11001 from '@/question-bank/結構/110/01/meta';
import structure10201 from '@/question-bank/結構/102/01/meta';
import law114Paper from '@/question-bank/法規/114/paper';
import construction114Paper from '@/question-bank/構造/114/paper';

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
  registerQuestion('law', 114, 2, law11402),
  registerQuestion('law', 114, 3, law11403),
  registerQuestion('law', 114, 4, law11404),
  registerQuestion('law', 114, 5, law11405),
  registerQuestion('law', 114, 6, law11406),
  registerQuestion('law', 114, 7, law11407),
  registerQuestion('law', 114, 8, law11408),
  registerQuestion('law', 114, 9, law11409),
  registerQuestion('law', 114, 10, law11410),
  registerQuestion('law', 114, 11, law11411),
  registerQuestion('law', 114, 12, law11412),
  registerQuestion('law', 114, 13, law11413),
  registerQuestion('law', 114, 14, law11414),
  registerQuestion('law', 114, 15, law11415),
  registerQuestion('law', 114, 16, law11416),
  registerQuestion('law', 114, 17, law11417),
  registerQuestion('law', 114, 18, law11418),
  registerQuestion('law', 114, 19, law11419),
  registerQuestion('law', 114, 20, law11420),
  registerQuestion('law', 114, 21, law11421),
  registerQuestion('law', 114, 22, law11422),
  registerQuestion('law', 114, 23, law11423),
  registerQuestion('law', 114, 24, law11424),
  registerQuestion('law', 114, 25, law11425),
  registerQuestion('law', 114, 26, law11426),
  registerQuestion('law', 114, 27, law11427),
  registerQuestion('law', 114, 28, law11428),
  registerQuestion('law', 114, 29, law11429),
  registerQuestion('law', 114, 30, law11430),
  registerQuestion('law', 114, 31, law11431),
  registerQuestion('law', 114, 32, law11432),
  registerQuestion('law', 114, 33, law11433),
  registerQuestion('law', 114, 34, law11434),
  registerQuestion('law', 114, 35, law11435),
  registerQuestion('law', 114, 36, law11436),
  registerQuestion('law', 114, 37, law11437),
  registerQuestion('law', 114, 38, law11438),
  registerQuestion('law', 114, 39, law11439),
  registerQuestion('law', 114, 40, law11440),
  registerQuestion('law', 114, 41, law11441),
  registerQuestion('law', 114, 42, law11442),
  registerQuestion('law', 114, 43, law11443),
  registerQuestion('law', 114, 44, law11444),
  registerQuestion('law', 114, 45, law11445),
  registerQuestion('law', 114, 46, law11446),
  registerQuestion('law', 114, 47, law11447),
  registerQuestion('law', 114, 48, law11448),
  registerQuestion('law', 114, 49, law11449),
  registerQuestion('law', 114, 50, law11450),
  registerQuestion('law', 114, 51, law11451),
  registerQuestion('law', 114, 52, law11452),
  registerQuestion('law', 114, 53, law11453),
  registerQuestion('law', 114, 54, law11454),
  registerQuestion('law', 114, 55, law11455),
  registerQuestion('law', 114, 56, law11456),
  registerQuestion('law', 114, 57, law11457),
  registerQuestion('law', 114, 58, law11458),
  registerQuestion('law', 114, 59, law11459),
  registerQuestion('law', 114, 60, law11460),
  registerQuestion('law', 114, 61, law11461),
  registerQuestion('law', 114, 62, law11462),
  registerQuestion('law', 114, 63, law11463),
  registerQuestion('law', 114, 64, law11464),
  registerQuestion('law', 114, 65, law11465),
  registerQuestion('law', 114, 66, law11466),
  registerQuestion('law', 114, 67, law11467),
  registerQuestion('law', 114, 68, law11468),
  registerQuestion('law', 114, 69, law11469),
  registerQuestion('law', 114, 70, law11470),
  registerQuestion('law', 114, 71, law11471),
  registerQuestion('law', 114, 72, law11472),
  registerQuestion('law', 114, 73, law11473),
  registerQuestion('law', 114, 74, law11474),
  registerQuestion('law', 114, 75, law11475),
  registerQuestion('law', 114, 76, law11476),
  registerQuestion('law', 114, 77, law11477),
  registerQuestion('law', 114, 78, law11478),
  registerQuestion('law', 114, 79, law11479),
  registerQuestion('law', 114, 80, law11480),
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
