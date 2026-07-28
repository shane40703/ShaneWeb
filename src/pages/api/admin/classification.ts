import type { NextApiRequest, NextApiResponse } from 'next';
import {
  updateQuestionClassification,
  type QuestionClassificationUpdate,
} from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

type ErrorResponse = { error: string };

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readUpdate(value: unknown): QuestionClassificationUpdate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const questionId = stringValue(body.questionId);
  if (
    !questionId ||
    !Array.isArray(body.classifications) ||
    !body.classifications.length ||
    body.classifications.some((classification) => typeof classification !== 'string')
  ) {
    return null;
  }
  return {
    questionId,
    classifications: body.classifications as string[],
  };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ question: Question } | ErrorResponse>,
) {
  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH');
    response.status(405).json({ error: '僅支援 PATCH' });
    return;
  }

  const authorKey = process.env.AUTHOR_EDIT_KEY?.trim();
  if (!authorKey) {
    response.status(503).json({ error: '伺服器尚未設定作者編輯金鑰' });
    return;
  }
  const requestKey = stringValue(request.headers['x-author-key']);
  if (requestKey !== authorKey) {
    response.status(401).json({ error: '作者編輯金鑰不正確' });
    return;
  }

  const update = readUpdate(request.body);
  if (!update) {
    response.status(400).json({ error: '分類資料格式不正確' });
    return;
  }

  try {
    response.status(200).json({
      question: await updateQuestionClassification(update),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '分類更新失敗',
    });
  }
}
