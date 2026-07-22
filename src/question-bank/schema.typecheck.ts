import type { PrimaryCategory, Topic } from '@/question-bank/schema';

// @ts-expect-error Construction categories are not valid law categories.
const invalidLawCategory: PrimaryCategory<'law'> = '材料';

// @ts-expect-error Construction topics are not valid law topics.
const invalidLawTopic: Topic<'law'> = '金屬材料';

void invalidLawCategory;
void invalidLawTopic;
