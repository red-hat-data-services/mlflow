import { Button, Typography, useDesignSystemTheme } from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';
import { useLocation } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import type { ExperimentPageTabName } from '../../experiment-tracking/constants';
import { useLockedWorkflowSwitch } from '../contexts/LockedWorkflowSwitchContext';

// Replaces the experiment page when GenAI is picked on the host's model training page
export const AgentTracesNotice = ({
  experimentId,
  tabName,
}: {
  experimentId: string;
  tabName: ExperimentPageTabName;
}) => {
  const { theme } = useDesignSystemTheme();
  const { search } = useLocation();
  const onUnsupportedTab = useLockedWorkflowSwitch()?.onUnsupportedTab;

  return (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        gap: theme.spacing.xs,
        padding: theme.spacing.xl,
      }}
    >
      <Typography.Text color="secondary">
        <FormattedMessage
          defaultMessage="The GenAI view of this experiment is on the Agent traces page."
          description="Notice shown when the GenAI workflow is picked on the model training experiment page"
        />
      </Typography.Text>
      {onUnsupportedTab && (
        <Button
          componentId="mlflow.odh.experiment-page.agent-traces-notice.open"
          type="link"
          onClick={() =>
            onUnsupportedTab({
              experimentId,
              tabName,
              relativePath: `/${experimentId}`,
              search,
              workflowType: WorkflowType.MACHINE_LEARNING,
            })
          }
        >
          <FormattedMessage
            defaultMessage="Open this experiment in Agent traces →"
            description="Link from the model training experiment page to the same experiment on the Agent traces page"
          />
        </Button>
      )}
    </div>
  );
};
