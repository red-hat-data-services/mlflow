import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { RoutePaths } from '../../experiment-tracking/routes';
import { LockedWorkflowSwitchProvider, useLockedWorkflowSwitch } from './LockedWorkflowSwitchContext';

const Consumer = () => {
  const { workflowType, setWorkflowType } = useLockedWorkflowSwitch() ?? {};
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="workflow-type">{workflowType ?? 'none'}</span>
      <button onClick={() => setWorkflowType?.(WorkflowType.GENAI)}>pick genai</button>
      <button onClick={() => navigate(RoutePaths.experimentPage.replace(':experimentId', '2'))}>open 2</button>
      <button onClick={() => navigate(RoutePaths.experimentPage.replace(':experimentId', '1'))}>open 1</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <MemoryRouter initialEntries={[RoutePaths.experimentPage.replace(':experimentId', '1')]}>
      <LockedWorkflowSwitchProvider>
        <Consumer />
      </LockedWorkflowSwitchProvider>
    </MemoryRouter>,
  );

describe('LockedWorkflowSwitchProvider', () => {
  test('starts on Model training and switches to GenAI', async () => {
    renderProvider();
    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);

    await userEvent.click(screen.getByText('pick genai'));

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.GENAI);
  });

  test('opens another experiment on Model training', async () => {
    renderProvider();
    await userEvent.click(screen.getByText('pick genai'));

    await userEvent.click(screen.getByText('open 2'));

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
  });

  test('reopens the first experiment on Model training', async () => {
    renderProvider();
    await userEvent.click(screen.getByText('pick genai'));

    await userEvent.click(screen.getByText('open 2'));
    await userEvent.click(screen.getByText('open 1'));

    expect(screen.getByTestId('workflow-type')).toHaveTextContent(WorkflowType.MACHINE_LEARNING);
  });

  test('is absent without the provider', () => {
    render(
      <MemoryRouter>
        <Consumer />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workflow-type')).toHaveTextContent('none');
  });
});
