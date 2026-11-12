import { BadRequestException, GatewayTimeoutException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface AssistantBotAnswer {
  answer: string;
  sources: Array<{ number: number; document_id: string; title: string; url: string | null; source_name: string }>;
  citations: AssistantBotAnswer['sources'];
  media: Array<{ url: string; type: 'image' | 'video' | 'audio'; source_number: number; license: string | null; creator: string | null }>;
  status: 'generated' | 'insufficient_evidence';
  model_version: string;
  model_id: string;
  request_id: string;
  finish_reason: string;
  citation_numbers_valid: boolean;
  retrieval_profile: string;
}

@Injectable()
export class AssistantBotService {
  async answer(question: string): Promise<AssistantBotAnswer> {
    if (typeof question !== 'string' || !question.trim() || question.length > 2000) {
      throw new BadRequestException('Question must contain 1 to 2000 characters');
    }
    const base = process.env.STAC_SERVICE_URL;
    const key = process.env.STAC_INTERNAL_KEY;
    if (!base || !key || key.length < 32) {
      throw new ServiceUnavailableException('STAC is not configured');
    }
    const timeoutMs = Number(process.env.STAC_REQUEST_TIMEOUT_MS ?? 600_000);
    const budgetSeconds = Number(process.env.STAC_INFERENCE_TIMEOUT_SECONDS ?? 540);
    if (!Number.isFinite(timeoutMs) || !Number.isFinite(budgetSeconds) ||
        budgetSeconds < 1 || budgetSeconds > 1800 || timeoutMs < budgetSeconds * 1000 + 30_000) {
      throw new ServiceUnavailableException('Invalid STAC timeout configuration');
    }
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(new URL('/internal/answer', base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stac-Key': key },
        body: JSON.stringify({ question: question.trim(), timeout_seconds: budgetSeconds }),
        signal,
      });
      if (response.status === 429) {
        throw new HttpException('Model đang xử lý câu hỏi trước. Vui lòng chờ rồi thử lại.', 429);
      }
      if (response.status === 504) {
        throw new GatewayTimeoutException('Model đã hết thời gian xử lý. Hãy thử câu hỏi ngắn hơn.');
      }
      if (!response.ok) throw new Error('STAC upstream unavailable');
      const value = await response.json() as AssistantBotAnswer;
      if (typeof value.answer !== 'string' || !Array.isArray(value.sources) ||
          !Array.isArray(value.citations) || !Array.isArray(value.media) || value.model_id !== 'stac-bot') {
        throw new Error('Invalid STAC response');
      }
      return value;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (signal.aborted) {
        throw new GatewayTimeoutException('Hết thời gian chờ dịch vụ AI; model có thể vẫn đang hoàn tất bước tính toán.');
      }
      throw new ServiceUnavailableException('STAC could not complete the request');
    }
  }
}
