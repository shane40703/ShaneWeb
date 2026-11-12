/** Draw without replacement, weighting each question by its saved wrong-answer count. */
export function drawWrongQuestions<T extends { id: string }>(
  questions: readonly T[],
  wrongCounts: Readonly<Record<string, number>>,
  count: number,
  random: () => number = Math.random,
): T[] {
  const remaining = questions.map((question) => {
    const count = wrongCounts[question.id];
    return { question, weight: Number.isSafeInteger(count) && count > 0 ? count : 1 };
  });
  const result: T[] = [];
  const limit = Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), remaining.length)) : 0;

  while (result.length < limit) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    const target = random() * total;
    let cumulative = 0;
    const index = remaining.findIndex((item) => {
      cumulative += item.weight;
      return target < cumulative;
    });
    // The final candidate is a safe fallback if an injected random source returns 1.
    result.push(remaining.splice(index < 0 ? remaining.length - 1 : index, 1)[0].question);
  }
  return result;
}
