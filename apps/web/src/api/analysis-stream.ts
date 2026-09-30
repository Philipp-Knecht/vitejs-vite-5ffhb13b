import { NDJSON_CONTENT_TYPE, type AnalysisDto, type AnalysisStage } from '@kaufcheck/shared';
import { ApiRequestError, errorFromResponse, toApiRequestError } from './client';
import { parseStreamEvent } from './guards';

export type AnalysisRequest =
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string; url?: string }
  | { kind: 'example'; exampleId?: string }
  | { kind: 'reanalysis'; savedListingId: string };

export type StageListener = (stage: AnalysisStage, status: 'started' | 'completed') => void;

function endpoint(request: AnalysisRequest): { path: string; body: unknown } {
  switch (request.kind) {
    case 'url':
      return { path: '/api/listings/analyze', body: { url: request.url } };
    case 'text':
      return {
        path: '/api/listings/analyze-text',
        body: { text: request.text, url: request.url || undefined },
      };
    case 'example':
      return { path: '/api/listings/analyze-example', body: { exampleId: request.exampleId } };
    case 'reanalysis':
      return {
        path: `/api/saved-listings/${encodeURIComponent(request.savedListingId)}/reanalyze`,
        body: {},
      };
  }
}

const brokenStream = () =>
  new ApiRequestError(
    {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Die Verbindung wurde unterbrochen. Bitte versuche es noch einmal.',
    },
    0,
  );

/**
 * Starts an analysis and reports the real pipeline stages as the server
 * streams them (NDJSON). Resolves with the result or rejects with an
 * {@link ApiRequestError}. Aborting the signal cancels the analysis on the
 * server; nothing is stored then.
 */
export async function runAnalysis(
  request: AnalysisRequest,
  options: { signal: AbortSignal; onStage?: StageListener },
): Promise<AnalysisDto> {
  const { path, body } = endpoint(request);
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: NDJSON_CONTENT_TYPE },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    throw toApiRequestError(error);
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw brokenStream();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        const event = parseStreamEvent(JSON.parse(line));
        if (!event) throw brokenStream();
        if (event.type === 'stage') options.onStage?.(event.stage, event.status);
        else if (event.type === 'result') return event.data;
        else throw new ApiRequestError(event.error, 200);
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw toApiRequestError(error);
  } finally {
    reader.cancel().catch(() => undefined);
  }
  throw brokenStream();
}
