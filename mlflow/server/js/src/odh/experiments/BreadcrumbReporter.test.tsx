import { jest, describe, test, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { QueryClient, QueryClientProvider } from '@databricks/web-shared/query-client';
import { MemoryRouter } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { BreadcrumbReporter } from './BreadcrumbReporter';

const renderReporter = (workflowType: WorkflowType | undefined, onBreadcrumbChange: jest.Mock) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={configureStore()({ entities: { experimentsById: { '123': { name: 'my-experiment' } } } })}>
        <MemoryRouter initialEntries={['/123/traces']}>
          <BreadcrumbReporter workflowType={workflowType} onBreadcrumbChange={onBreadcrumbChange} />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );

describe('BreadcrumbReporter', () => {
  test('labels the root crumb Agent observability when workflowType is genai', () => {
    const onBreadcrumbChange = jest.fn();
    renderReporter(WorkflowType.GENAI, onBreadcrumbChange);

    expect(onBreadcrumbChange).toHaveBeenLastCalledWith([
      { label: 'Agent observability', path: '/' },
      { label: 'my-experiment', path: '/123' },
    ]);
  });

  test.each([
    ['machine_learning', WorkflowType.MACHINE_LEARNING],
    ['omitted', undefined],
  ])('labels the root crumb Experiments when workflowType is %s', (_, workflowType) => {
    const onBreadcrumbChange = jest.fn();
    renderReporter(workflowType, onBreadcrumbChange);

    expect(onBreadcrumbChange).toHaveBeenLastCalledWith([
      { label: 'Experiments', path: '/' },
      { label: 'my-experiment', path: '/123' },
    ]);
  });
});
