import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSearchEvaluationDatasets } from './useSearchEvaluationDatasets';
import { QueryClient, QueryClientProvider } from '@mlflow/mlflow/src/common/utils/reactQueryHooks';
import { fetchAPI } from '@mlflow/mlflow/src/common/utils/FetchUtils';
import { useCreateEvaluationDatasetMutation } from './useCreateEvaluationDatasetMutation';
import {
  V2_DATASETS_PAGE_QUERY_KEY,
  useDatasetsPageQuery,
} from '../../experiment-evaluation-datasets-v2/hooks/useDatasetsPageQuery';

jest.mock('@mlflow/mlflow/src/common/utils/FetchUtils', () => ({
  fetchAPI: jest.fn(),
  getAjaxUrl: (url: string) => url,
}));

describe('useCreateEvaluationDatasetMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  test('invalidates the v2 datasets list so the new dataset shows up', async () => {
    jest.mocked(fetchAPI).mockResolvedValue({ dataset: { dataset_id: 'd-1', name: 'my_ds' } });
    const pageKey = [V2_DATASETS_PAGE_QUERY_KEY, 'exp-1', '', 25, undefined];
    queryClient.setQueryData(pageKey, { datasets: [] });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useCreateEvaluationDatasetMutation({ onSuccess }), { wrapper });
    act(() => {
      result.current.createEvaluationDatasetMutation({ datasetName: 'my_ds', experimentIds: ['exp-1'] });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(queryClient.getQueryState(pageKey)?.isInvalidated).toBe(true);
  });
});

test('creating a dataset refreshes both legacy and v2 dataset lists', async () => {
  const dataset = { dataset_id: 'dataset-1', name: 'New dataset' };
  let datasets: (typeof dataset)[] = [];
  jest.mocked(fetchAPI).mockImplementation(async (url) => {
    if (url.endsWith('/datasets/create')) {
      datasets = [dataset];
      return { dataset };
    }
    return { datasets };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      legacy: useSearchEvaluationDatasets({ experimentId: 'experiment-1' }),
      v2: useDatasetsPageQuery({
        experimentId: 'experiment-1',
        nameFilter: '',
        pageSize: 50,
        pageToken: undefined,
      }),
      create: useCreateEvaluationDatasetMutation({}),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.legacy.isLoading).toBe(false);
    expect(result.current.v2.isSuccess).toBe(true);
  });
  expect(result.current.legacy.data).toEqual([]);
  expect(result.current.v2.data?.datasets).toEqual([]);

  act(() => result.current.create.createEvaluationDatasetMutation({ datasetName: dataset.name }));

  await waitFor(() => {
    expect(result.current.legacy.data).toEqual([dataset]);
    expect(result.current.v2.data?.datasets).toMatchObject([dataset]);
  });
  client.clear();
});
