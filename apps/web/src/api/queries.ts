import type {
  AnalysisDto,
  AnalysisListItem,
  CancellationRequest,
  ComparisonDto,
  ContractNoticeReceipt,
  MeDto,
  OrderCreated,
  OrderDto,
  OrderRequest,
  PublicConfig,
  RedirectResponse,
  SavedListingDto,
  SavedListingsResponse,
  WithdrawalRequest,
} from '@kaufcheck/shared';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from './client';

export const queryKeys = {
  config: ['config'] as const,
  me: ['me'] as const,
  analysis: (id: string) => ['analysis', id] as const,
  savedListings: ['saved-listings'] as const,
  history: ['history'] as const,
  comparison: (ids: readonly string[]) => ['comparison', ...ids] as const,
  order: (number: string) => ['order', number] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Retry only transient server problems, never 4xx answers.
        retry: (count, error) =>
          count < 2 &&
          error instanceof ApiRequestError &&
          (error.status === 0 || error.status >= 500),
      },
    },
  });
}

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: ({ signal }) => api.get<PublicConfig>('/api/config', signal),
    staleTime: 5 * 60_000,
  });
}

type MePolling = (data: MeDto | undefined, updates: number) => number | false;

export function useMe(options: { poll?: MePolling } = {}) {
  const { poll } = options;
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.get<MeDto>('/api/me', signal),
    staleTime: 30_000,
    refetchInterval: poll
      ? (query) => poll(query.state.data, query.state.dataUpdateCount)
      : undefined,
  });
}

export function useAnalysis(id: string) {
  return useQuery({
    queryKey: queryKeys.analysis(id),
    queryFn: ({ signal }) =>
      api.get<AnalysisDto>(`/api/analyses/${encodeURIComponent(id)}`, signal),
    staleTime: Infinity,
  });
}

export function useSavedListings(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.savedListings,
    queryFn: ({ signal }) => api.get<SavedListingsResponse>('/api/saved-listings', signal),
    enabled,
  });
}

export function useHistory(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: ({ signal }) => api.get<{ items: AnalysisListItem[] }>('/api/analyses', signal),
    enabled,
  });
}

export function useComparison(ids: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.comparison(ids),
    queryFn: ({ signal }) =>
      api.post<ComparisonDto>('/api/comparisons', { savedListingIds: ids }, signal),
    enabled: ids.length >= 2,
    staleTime: Infinity,
    retry: false,
  });
}

/** Everything that depends on who is signed in. */
function useInvalidateSession() {
  const queryClient = useQueryClient();
  return async () => {
    queryClient.removeQueries({ queryKey: queryKeys.savedListings });
    queryClient.removeQueries({ queryKey: queryKeys.history });
    queryClient.removeQueries({ queryKey: ['comparison'] });
    queryClient.removeQueries({ queryKey: ['analysis'] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

export function useLogin() {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post('/api/auth/login', input),
    onSuccess: invalidate,
  });
}

export function useRegister() {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post('/api/auth/register', input),
    onSuccess: invalidate,
  });
}

export function useLogout() {
  const invalidate = useInvalidateSession();
  return useMutation({ mutationFn: () => api.post('/api/auth/logout'), onSuccess: invalidate });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: (password: string) => api.delete('/api/account', { password }),
    onSuccess: invalidate,
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => api.post('/api/auth/password-reset/request', { email }),
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api.post('/api/auth/password-reset/confirm', input),
  });
}

export function useSaveListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (analysisId: string) =>
      api.post<SavedListingDto>('/api/saved-listings', { analysisId }),
    onSuccess: (saved) => {
      queryClient.setQueryData<AnalysisDto>(queryKeys.analysis(saved.analysisId), (current) =>
        current ? { ...current, savedListingId: saved.id } : current,
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.savedListings });
    },
  });
}

export function useRenameSavedListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string | null }) =>
      api.patch<SavedListingDto>(`/api/saved-listings/${encodeURIComponent(input.id)}`, {
        title: input.title,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.savedListings }),
  });
}

export function useDeleteSavedListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/saved-listings/${encodeURIComponent(id)}`),
    onSuccess: async (_result, id) => {
      queryClient.setQueriesData<AnalysisDto>({ queryKey: ['analysis'] }, (current) =>
        current?.savedListingId === id ? { ...current, savedListingId: null } : current,
      );
      queryClient.removeQueries({ queryKey: ['comparison'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedListings });
    },
  });
}

/** Places the order (the button "Zahlungspflichtig bestellen") and returns the payment page. */
export function usePlaceOrder() {
  return useMutation({
    mutationFn: (input: OrderRequest) => api.post<OrderCreated>('/api/billing/orders', input),
  });
}

/** An order after the payment page; polls until the payment provider has confirmed it. */
export function useOrder(number: string) {
  return useQuery({
    queryKey: queryKeys.order(number),
    queryFn: ({ signal }) =>
      api.get<OrderDto>(`/api/billing/orders/${encodeURIComponent(number)}`, signal),
    enabled: number.length > 0,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && query.state.dataUpdateCount < 40 ? 2000 : false,
  });
}

/** "jetzt kündigen" (§ 312k BGB). */
export function useSendCancellation() {
  return useMutation({
    mutationFn: (input: CancellationRequest) =>
      api.post<ContractNoticeReceipt>('/api/contracts/cancellations', input),
  });
}

/** "Widerruf bestätigen" (§ 356a BGB). */
export function useSendWithdrawal() {
  return useMutation({
    mutationFn: (input: WithdrawalRequest) =>
      api.post<ContractNoticeReceipt>('/api/contracts/withdrawals', input),
  });
}

export function usePortal() {
  return useMutation({ mutationFn: () => api.post<RedirectResponse>('/api/billing/portal') });
}
