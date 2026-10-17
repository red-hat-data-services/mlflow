import { jest, describe, beforeAll, beforeEach, test, expect } from '@jest/globals';
import { DesignSystemProvider } from '@databricks/design-system';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, rest } from 'msw';
import { IntlProvider } from 'react-intl';
import { setupTestRouter, TestRouter, waitForRoutesToBeRendered } from '../../common/utils/RoutingTestUtils';
import { setupServer } from '../../common/utils/setup-msw';
import { TestApolloProvider } from '../../common/utils/TestApolloProvider';
import { MockedReduxStoreProvider } from '../../common/utils/TestUtils';
import { QueryClient, QueryClientProvider } from '@mlflow/mlflow/src/common/utils/reactQueryHooks';
import { createLazyRouteElement, createMLflowRoutePath } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { ExperimentKind } from '../../experiment-tracking/constants';
import { PageId, RoutePaths } from '../../experiment-tracking/routes';
import ExperimentPageTabs from '../../experiment-tracking/pages/experiment-page-tabs/ExperimentPageTabs';
import { ForcedWorkflowTypeProvider } from '../contexts/ForcedWorkflowTypeProvider';
import { LockedWorkflowSwitchProvider } from '../contexts/LockedWorkflowSwitchContext';
import type { UnsupportedTabInfo } from './UnsupportedTabGuard';

// eslint-disable-next-line no-restricted-syntax -- TODO(FEINF-4392)
jest.setTimeout(60000); // Larger timeout for integration testing

jest.mock('../../common/utils/FeatureUtils', () => ({
  ...jest.requireActual<typeof import('../../common/utils/FeatureUtils')>('../../common/utils/FeatureUtils'),
  shouldEnableWorkflowBasedNavigation: jest.fn().mockReturnValue(true),
}));

jest.mock('../../common/utils/embedUtils', () => ({
  ...jest.requireActual<typeof import('../../common/utils/embedUtils')>('../../common/utils/embedUtils'),
  useIsIntegrated: () => true,
}));

jest.mock('../../experiment-tracking/pages/experiment-runs/ExperimentRunsPage', () => ({
  __esModule: true,
  default: () => <div>Experiment runs page</div>,
}));

describe('AgentTracesNotice', () => {
  const { history } = setupTestRouter();

  const server = setupServer(
    graphql.query('MlflowGetExperimentQuery', (req, res, ctx) =>
      res(
        ctx.data({
          mlflowGetExperiment: {
            __typename: 'MlflowGetExperimentResponse',
            apiError: null,
            experiment: {
              __typename: 'MlflowExperiment',
              artifactLocation: null,
              name: 'Test experiment name',
              creationTime: null,
              experimentId: '12345678',
              lastUpdateTime: null,
              lifecycleStage: 'active',
              tags: [{ key: 'mlflow.experimentKind', value: ExperimentKind.CUSTOM_MODEL_DEVELOPMENT }],
            },
          },
        }),
      ),
    ),
    rest.get('/ajax-api/2.0/mlflow/traces', (req, res, ctx) => res(ctx.json({ traces: [] }))),
    rest.post('/ajax-api/2.0/mlflow/runs/search', (req, res, ctx) => res(ctx.json({ runs: [] }))),
  );

  const renderExperimentPage = ({
    workflowType,
    withWorkflowSwitch,
    onUnsupportedTab,
  }: {
    workflowType: WorkflowType;
    withWorkflowSwitch: boolean;
    onUnsupportedTab?: (info: UnsupportedTabInfo) => void;
  }) => {
    const HostExperimentPage = () => (
      <ForcedWorkflowTypeProvider workflowType={workflowType}>
        {withWorkflowSwitch ? (
          <LockedWorkflowSwitchProvider onUnsupportedTab={onUnsupportedTab}>
            <ExperimentPageTabs />
          </LockedWorkflowSwitchProvider>
        ) : (
          <ExperimentPageTabs />
        )}
      </ForcedWorkflowTypeProvider>
    );

    return render(
      <TestApolloProvider disableCache>
        <MockedReduxStoreProvider state={{ entities: { experimentTagsByExperimentId: {}, experimentsById: {} } }}>
          <IntlProvider locale="en">
            <QueryClientProvider client={new QueryClient()}>
              <DesignSystemProvider>
                <TestRouter
                  routes={[
                    {
                      path: RoutePaths.experimentPage,
                      pageId: PageId.experimentPage,
                      element: <HostExperimentPage />,
                      children: [
                        {
                          path: RoutePaths.experimentPageTabRuns,
                          pageId: PageId.experimentPageTabRuns,
                          element: createLazyRouteElement(
                            () => import('../../experiment-tracking/pages/experiment-runs/ExperimentRunsPage'),
                          ),
                        },
                      ],
                    },
                  ]}
                  history={history}
                  initialEntries={[createMLflowRoutePath('/experiments/12345678/runs?workspace=team-a')]}
                />
              </DesignSystemProvider>
            </QueryClientProvider>
          </IntlProvider>
        </MockedReduxStoreProvider>
      </TestApolloProvider>,
    );
  };

  beforeAll(() => {
    jest.useRealTimers();
    process.env['MLFLOW_USE_ABSOLUTE_AJAX_URLS'] = 'true';
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  test('picking GenAI on the model training page shows the notice, and Model training brings the page back', async () => {
    const onUnsupportedTab = jest.fn();
    renderExperimentPage({ workflowType: WorkflowType.MACHINE_LEARNING, withWorkflowSwitch: true, onUnsupportedTab });
    await waitFor(() => waitForRoutesToBeRendered(), { timeout: 10000 });
    await waitFor(() => expect(screen.getByText('Experiment runs page')).toBeInTheDocument());

    expect(await screen.findByRole('button', { name: 'Model training' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'GenAI' }));

    expect(screen.getByRole('button', { name: 'GenAI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('The GenAI view of this experiment is on the Agent traces page.')).toBeInTheDocument();
    expect(screen.queryByText('Experiment runs page')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open this experiment in Agent traces →' }));

    expect(onUnsupportedTab).toHaveBeenCalledWith({
      experimentId: '12345678',
      tabName: 'runs',
      relativePath: '/12345678',
      search: '?workspace=team-a',
      workflowType: WorkflowType.MACHINE_LEARNING,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Model training' }));

    expect(screen.getByText('Experiment runs page')).toBeInTheDocument();
    expect(
      screen.queryByText('The GenAI view of this experiment is on the Agent traces page.'),
    ).not.toBeInTheDocument();
  });

  test('the notice has no link when the host gives no way to open the GenAI page', async () => {
    renderExperimentPage({ workflowType: WorkflowType.MACHINE_LEARNING, withWorkflowSwitch: true });
    await waitFor(() => waitForRoutesToBeRendered(), { timeout: 10000 });
    await waitFor(() => expect(screen.getByText('Experiment runs page')).toBeInTheDocument());

    await userEvent.click(await screen.findByRole('button', { name: 'GenAI' }));

    expect(screen.getByText('The GenAI view of this experiment is on the Agent traces page.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open this experiment in Agent traces →' })).not.toBeInTheDocument();
  });

  test('a locked page without the workflow switch shows no toggle', async () => {
    renderExperimentPage({ workflowType: WorkflowType.GENAI, withWorkflowSwitch: false });
    await waitFor(() => waitForRoutesToBeRendered(), { timeout: 10000 });
    await waitFor(() => expect(screen.getByText('Experiment runs page')).toBeInTheDocument());
    await screen.findByText('Test experiment name');

    expect(screen.queryByRole('button', { name: 'GenAI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Model training' })).not.toBeInTheDocument();
  });
});
