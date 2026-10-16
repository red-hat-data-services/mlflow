import { jest, describe, test, expect } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { HostWorkflowTypeProvider } from '../contexts/ForcedWorkflowTypeProvider';
import { getExperimentTrackingRouteElements } from './experimentTrackingRoutes';

jest.mock('../../experiment-tracking/pages/experiment-page-tabs/ExperimentPageTabs', () => ({
  __esModule: true,
  default: function ExperimentPageTabs() {
    const { useWorkflowType: useMockedWorkflowType } = jest.requireActual<
      typeof import('../../common/contexts/WorkflowTypeContext')
    >('../../common/contexts/WorkflowTypeContext');
    const { workflowType } = useMockedWorkflowType();
    return <span data-testid="workflow-type">{workflowType}</span>;
  },
}));

const renderRoutes = (initialEntry: string, workflowType?: WorkflowType) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HostWorkflowTypeProvider workflowType={workflowType}>
        <React.Suspense fallback={null}>
          <Routes>{getExperimentTrackingRouteElements(workflowType)}</Routes>
        </React.Suspense>
      </HostWorkflowTypeProvider>
    </MemoryRouter>,
  );

describe('getExperimentTrackingRouteElements', () => {
  test('uses the forced workflow type from the wrapper provider on experiment pages', async () => {
    renderRoutes('/123/runs?workflowType=genai', WorkflowType.MACHINE_LEARNING);

    expect(await screen.findByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
  });

  test('reads the URL param when no workflow type is forced', async () => {
    renderRoutes('/123/runs?workflowType=genai');

    expect(await screen.findByTestId('workflow-type')).toHaveTextContent(WorkflowType.GENAI);
  });
});
