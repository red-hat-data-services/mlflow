import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from '../../common/utils/RoutingUtils';
import { useWorkflowType, WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { ExperimentKind } from '../../experiment-tracking/constants';
import { useGetExperimentQuery } from '../../experiment-tracking/hooks/useExperimentQuery';
import { useNavigateToExperimentPageTab } from '../../experiment-tracking/components/experiment-page/hooks/useNavigateToExperimentPageTab';
import { ForcedWorkflowTypeProvider, HostWorkflowTypeProvider } from './ForcedWorkflowTypeProvider';

jest.mock('../../experiment-tracking/hooks/useExperimentQuery', () => ({
  useGetExperimentQuery: jest.fn(),
}));

jest.mock('../../experiment-tracking/hooks/useServerInfo', () => ({
  ...jest.requireActual<typeof import('../../experiment-tracking/hooks/useServerInfo')>(
    '../../experiment-tracking/hooks/useServerInfo',
  ),
  useIsFileStore: () => false,
}));

const STORAGE_KEY = 'mlflow.workflowType_v1';

const Consumer = () => {
  const { workflowType, setWorkflowType, isLocked } = useWorkflowType();
  const { pathname, search } = useLocation();
  return (
    <div>
      <span data-testid="workflow-type">{workflowType}</span>
      <span data-testid="workflow-type-locked">{String(Boolean(isLocked))}</span>
      <span data-testid="location">{`${pathname}${search}`}</span>
      <button onClick={() => setWorkflowType(WorkflowType.MACHINE_LEARNING)}>switch to ml</button>
    </div>
  );
};

const renderForced = (initialEntry: string, workflowType: WorkflowType) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ForcedWorkflowTypeProvider workflowType={workflowType}>
        <Consumer />
      </ForcedWorkflowTypeProvider>
    </MemoryRouter>,
  );

describe('ForcedWorkflowTypeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('ignores a conflicting URL param without rewriting the URL', () => {
    renderForced('/experiments/1/runs?workflowType=genai&workspace=ws', WorkflowType.MACHINE_LEARNING);

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
    expect(screen.getByTestId('location')).toHaveTextContent('/experiments/1/runs?workflowType=genai&workspace=ws');
  });

  test('ignores the value stored in localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(WorkflowType.MACHINE_LEARNING));
    renderForced('/experiments/1/traces', WorkflowType.GENAI);

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.GENAI);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/experiments\/1\/traces$/);
  });

  test('ignores an invalid URL param', () => {
    renderForced('/experiments/1/traces?workflowType=invalid', WorkflowType.GENAI);

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.GENAI);
  });

  test('setWorkflowType is a no-op and does not write localStorage', async () => {
    renderForced('/experiments/1/traces', WorkflowType.GENAI);

    await act(async () => {
      await userEvent.click(screen.getByText('switch to ml'));
    });

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.GENAI);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/experiments\/1\/traces$/);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('HostWorkflowTypeProvider', () => {
  const renderHost = (initialEntry: string, workflowType?: WorkflowType) =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <HostWorkflowTypeProvider workflowType={workflowType}>
          <Consumer />
        </HostWorkflowTypeProvider>
      </MemoryRouter>,
    );

  test('forces the workflow type when one is passed', () => {
    renderHost('/experiments/1/runs?workflowType=genai', WorkflowType.MACHINE_LEARNING);

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
    expect(screen.getByTestId('workflow-type-locked')).toHaveTextContent('true');
  });

  test('falls back to the upstream provider when no workflow type is passed', () => {
    renderHost('/experiments/1/runs?workflowType=machine_learning');

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
    expect(screen.getByTestId('location')).toHaveTextContent('/experiments/1/runs?workflowType=machine_learning');
    expect(screen.getByTestId('workflow-type-locked')).toHaveTextContent('false');
  });
});

describe('useNavigateToExperimentPageTab under ForcedWorkflowTypeProvider', () => {
  const ExperimentPage = () => {
    useNavigateToExperimentPageTab({ enabled: true, experimentId: '123' });
    return null;
  };

  const LocationDisplay = () => {
    const { pathname, search } = useLocation();
    return <span data-testid="location">{`${pathname}${search}`}</span>;
  };

  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(WorkflowType.GENAI));
    jest.mocked(useGetExperimentQuery).mockReturnValue({
      data: {
        experimentId: '123',
        tags: [{ key: 'mlflow.experimentKind', value: ExperimentKind.GENAI_DEVELOPMENT }],
      },
      loading: false,
    } as any);
  });

  test('navigates a cached GenAI experiment to Runs when forced to machine_learning', () => {
    render(
      <MemoryRouter initialEntries={['/experiments/123']}>
        <ForcedWorkflowTypeProvider workflowType={WorkflowType.MACHINE_LEARNING}>
          <Routes>
            <Route path="/experiments/:experimentId" element={<ExperimentPage />} />
            <Route path="/experiments/:experimentId/*" element={<LocationDisplay />} />
          </Routes>
        </ForcedWorkflowTypeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/experiments\/123\/runs\?workflowType=machine_learning$/,
    );
  });
});
