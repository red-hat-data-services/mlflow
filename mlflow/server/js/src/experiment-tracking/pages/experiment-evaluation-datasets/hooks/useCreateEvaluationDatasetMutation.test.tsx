import { afterEach, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@mlflow/mlflow/src/common/utils/reactQueryHooks';
import * as FetchUtils from '@mlflow/mlflow/src/common/utils/FetchUtils';
import { useDatasetsPageQuery } from '../../experiment-evaluation-datasets-v2/hooks/useDatasetsPageQuery';
import { useSearchEvaluationDatasets } from './useSearchEvaluationDatasets';
import { useCreateEvaluationDatasetMutation } from './useCreateEvaluationDatasetMutation';

afterEach(() => {
  jest.restoreAllMocks();
});

test('creating a dataset refreshes both legacy and v2 dataset lists', async () => {
  const dataset = { dataset_id: 'dataset-1', name: 'New dataset' };
  let datasets: (typeof dataset)[] = [];
  jest.spyOn(FetchUtils, 'fetchAPI').mockImplementation(async (url) => {
    if (url.endsWith('/datasets/create')) {
      datasets = [dataset];
      return { dataset };
    }
    return { datasets };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
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
    expect(result.current.v2.data?.datasets).toEqual([dataset]);
  });
  client.clear();
});
