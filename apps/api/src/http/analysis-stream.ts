import { PassThrough } from 'node:stream';
import { NDJSON_CONTENT_TYPE, type AnalysisDto, type AnalysisStreamEvent } from '@kaufcheck/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AnalysisRunContext } from '../application/analysis-service';
import { AppError, isAppError } from '../lib/errors';

type Runner = (ctx: Omit<AnalysisRunContext, 'actor'>) => Promise<AnalysisDto>;

/**
 * Runs an analysis for an HTTP request. With `Accept: application/x-ndjson`
 * the real pipeline stages are streamed as they happen, followed by the
 * result or an error event; otherwise a plain JSON response is returned.
 * If the client disconnects, the pipeline is aborted and nothing is stored.
 */
export async function respondWithAnalysis(
  request: FastifyRequest,
  reply: FastifyReply,
  run: Runner,
): Promise<unknown> {
  const controller = new AbortController();
  reply.raw.on('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });

  const accept = request.headers.accept ?? '';
  if (!accept.includes(NDJSON_CONTENT_TYPE)) {
    const dto = await run({ signal: controller.signal });
    return reply.status(201).send(dto);
  }

  const stream = new PassThrough();
  const write = (event: AnalysisStreamEvent) => {
    if (!stream.writableEnded) stream.write(`${JSON.stringify(event)}\n`);
  };
  run({
    signal: controller.signal,
    onStage: (stage, status) => write({ type: 'stage', stage, status }),
  })
    .then((data) => write({ type: 'result', data }))
    .catch((error: unknown) => {
      const appError = isAppError(error) ? error : new AppError('INTERNAL_ERROR');
      if (appError.code !== 'REQUEST_ABORTED')
        write({ type: 'error', error: appError.toApiError(request.id) });
    })
    .finally(() => stream.end());

  return reply
    .header('content-type', `${NDJSON_CONTENT_TYPE}; charset=utf-8`)
    .header('cache-control', 'no-store')
    .header('x-accel-buffering', 'no')
    .send(stream);
}
