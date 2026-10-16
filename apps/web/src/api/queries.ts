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
  OwnedCarDto,
  OwnedCarInput,
  CarLogEntryDto,
  CarLogEntryInput,
  CarLogResponse,
  OwnedCarsResponse,
  PublicConfig,
  RedirectResponse,
  SavedListingDto,
  SavedListingsResponse,
  SavedSearchDto,
  SavedSearchesResponse,
  SaveSearchRequest,
  WithdrawalRequest,
} from '@kaufcheck/shared';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearSaleContractDraft } from '../features/sale-contract/draft';
import { clearListingTextDraft } from '../features/selling/draft';
import { MONTHLY_COSTS_STORAGE_PREFIX } from '../features/compare/monthly-costs-storage';
import { removeByPrefix } from '../lib/storage';
import { clearPrivateOfflineData } from '../lib/offline';
import { useHydrated } from '../lib/use-hydrated';
import { api, ApiRequestError } from './client';

export const queryKeys = {
  config: ['config'] as const,
  me: ['me'] as const,
  analysis: (id: string) => ['analysis', id] as const,
  savedListings: ['saved-listings'] as const,
  savedSearches: ['saved-searches'] as const,
  ownedCars: ['owned-cars'] as const,
  carLog: (carId: string) => ['car-log', carId] as const,
  history: ['history'] as const,
  comparison: (ids: readonly string[]) => ['comparison', ...ids] as const,
  order: (number: string) => ['order', number] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Offline, requests still go out: the service worker answers from its cache.
        networkMode: 'offlineFirst',
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

/**
 * The configuration as prerendered pages may show it: undefined until the page has hydrated,
 * so that the first render matches the prerendered HTML (which shows the defaults). A
 * configuration that loads during hydration would otherwise change texts mid-way.
 */
export function useHydratedConfig(): PublicConfig | undefined {
  const hydrated = useHydrated();
  const config = useConfig();
  return hydrated ? config.data : undefined;
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

export function useAnalysis(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysis(id),
    queryFn: ({ signal }) =>
      api.get<AnalysisDto>(`/api/analyses/${encodeURIComponent(id)}`, signal),
    staleTime: Infinity,
    enabled,
  });
}

export function useSavedListings(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.savedListings,
    queryFn: ({ signal }) => api.get<SavedListingsResponse>('/api/saved-listings', signal),
    enabled,
  });
}

export function useSavedSearches(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.savedSearches,
    queryFn: ({ signal }) => api.get<SavedSearchesResponse>('/api/saved-searches', signal),
    enabled,
  });
}

export function useSaveSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSearchRequest) =>
      api.post<SavedSearchDto>('/api/saved-searches', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
  });
}

export function useOwnedCars(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.ownedCars,
    queryFn: ({ signal }) => api.get<OwnedCarsResponse>('/api/owned-cars', signal),
    enabled,
  });
}

export function useAddOwnedCar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OwnedCarInput) => api.post<OwnedCarDto>('/api/owned-cars', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownedCars }),
  });
}

export function useUpdateOwnedCar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OwnedCarInput }) =>
      api.put<OwnedCarDto>(`/api/owned-cars/${encodeURIComponent(id)}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownedCars }),
  });
}

export function useDeleteOwnedCar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/owned-cars/${encodeURIComponent(id)}`),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.carLog(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.ownedCars });
    },
  });
}

export function useCarLog(carId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.carLog(carId),
    queryFn: ({ signal }) =>
      api.get<CarLogResponse>(`/api/owned-cars/${encodeURIComponent(carId)}/log`, signal),
    enabled,
  });
}

/** Adds an entry, or changes it when `id` is given. */
export function useSaveCarLogEntry(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: CarLogEntryInput }) => {
      const base = `/api/owned-cars/${encodeURIComponent(carId)}/log`;
      return id
        ? api.put<CarLogEntryDto>(`${base}/${encodeURIComponent(id)}`, input)
        : api.post<CarLogEntryDto>(base, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.carLog(carId) }),
  });
}

export function useDeleteCarLogEntry(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/owned-cars/${encodeURIComponent(carId)}/log/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.carLog(carId) }),
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/saved-searches/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches }),
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
    // Signing in after saving a check without an account keeps the copy: the check
    // moves to the new account. Logging out or switching accounts deletes it.
    const before = queryClient.getQueryData<MeDto>(queryKeys.me);
    if (before?.user !== null) {
      await clearPrivateOfflineData();
      // Another person may use the device next; signing in after typing keeps the draft.
      clearSaleContractDraft();
      clearListingTextDraft();
      // Own assumptions for saved offers of this account.
      removeByPrefix(MONTHLY_COSTS_STORAGE_PREFIX);
    }
    queryClient.removeQueries({ queryKey: queryKeys.savedListings });
    queryClient.removeQueries({ queryKey: queryKeys.savedSearches });
    queryClient.removeQueries({ queryKey: queryKeys.ownedCars });
    queryClient.removeQueries({ queryKey: ['car-log'] });
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
