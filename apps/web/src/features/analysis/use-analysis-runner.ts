import type { AnalysisStage } from '@kaufcheck/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { runAnalysis, type AnalysisRequest } from '../../api/analysis-stream';
import { toApiRequestError, type ApiRequestError } from '../../api/client';
import { queryKeys, useConfig } from '../../api/queries';

export type StageState = 'pending' | 'active' | 'done';

export interface StageView {
  stage: AnalysisStage;
  state: StageState;
}

export type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; request: AnalysisRequest; stages: StageView[] }
  | { phase: 'failed'; request: AnalysisRequest; error: ApiRequestError; stages: StageView[] };

const BASE_STAGES: readonly AnalysisStage[] = [
  'validate',
  'retrieve',
  'extract',
  'analyze',
  'questions',
];

function initialStages(withAi: boolean): StageView[] {
  return [...BASE_STAGES, ...(withAi ? (['ai'] as const) : [])].map((stage) => ({
    stage,
    state: 'pending',
  }));
}

function applyStage(
  stages: StageView[],
  stage: AnalysisStage,
  status: 'started' | 'completed',
): StageView[] {
  const known = stages.some((item) => item.stage === stage)
    ? stages
    : [...stages, { stage, state: 'pending' as const }];
  return known.map((item) =>
    item.stage === stage ? { stage, state: status === 'started' ? 'active' : 'done' } : item,
  );
}

/**
 * Runs an analysis with live progress from the server's real pipeline
 * stages and opens the result when it is ready. Leaving the page or
 * cancelling aborts the analysis on the server (nothing is stored).
 */
export function useAnalysisRunner() {
  const [state, setState] = useState<RunState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const config = useConfig();
  const aiEnabled = config.data?.features.ai ?? false;

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (request: AnalysisRequest) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ phase: 'running', request, stages: initialStages(aiEnabled) });
      try {
        const dto = await runAnalysis(request, {
          signal: current.signal,
          onStage: (stage, status) =>
            setState((previous) =>
              previous.phase === 'running'
                ? { ...previous, stages: applyStage(previous.stages, stage, status) }
                : previous,
            ),
        });
        queryClient.setQueryData(queryKeys.analysis(dto.id), dto);
        void queryClient.invalidateQueries({ queryKey: queryKeys.me });
        if (request.kind === 'reanalysis')
          void queryClient.invalidateQueries({ queryKey: queryKeys.savedListings });
        void navigate(`/analyse/${dto.id}`);
      } catch (error) {
        if (current.signal.aborted) {
          setState({ phase: 'idle' });
          return;
        }
        const apiError = toApiRequestError(error);
        // Failed requests may still have changed the usage counter (e.g. limit reached).
        void queryClient.invalidateQueries({ queryKey: queryKeys.me });
        setState((previous) => ({
          phase: 'failed',
          request,
          error: apiError,
          stages: previous.phase === 'running' ? previous.stages : [],
        }));
      }
    },
    [aiEnabled, navigate, queryClient],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, start, cancel, reset };
}

export type AnalysisRunner = ReturnType<typeof useAnalysisRunner>;
