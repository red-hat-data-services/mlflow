import React, { createContext, useContext, useMemo, useState } from 'react';
import { matchPath, useLocation } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { RoutePaths } from '../../experiment-tracking/routes';
import type { UnsupportedTabInfo } from '../experiments/UnsupportedTabGuard';

interface LockedWorkflowSwitchContextType {
  workflowType: WorkflowType;
  setWorkflowType: (workflowType: WorkflowType) => void;
  onUnsupportedTab?: (info: UnsupportedTabInfo) => void;
}

const LockedWorkflowSwitchContext = createContext<LockedWorkflowSwitchContextType | undefined>(undefined);

// Keeps the workflow toggle on the host's model training page, whose workflow type stays locked.
// Picking GenAI only moves the toggle, and the experiment page shows a notice pointing to the
// host's GenAI page. Each experiment opens with Model training selected.
export const LockedWorkflowSwitchProvider = ({
  onUnsupportedTab,
  children,
}: {
  onUnsupportedTab?: (info: UnsupportedTabInfo) => void;
  children: React.ReactNode;
}) => {
  const { pathname } = useLocation();
  const experimentId = matchPath({ path: RoutePaths.experimentPage, end: false }, pathname)?.params['experimentId'];
  const [selection, setSelection] = useState<{ experimentId?: string; workflowType: WorkflowType }>();
  // Forget the pick on leaving the experiment, so coming back to it opens on Model training too
  if (selection && selection.experimentId !== experimentId) {
    setSelection(undefined);
  }
  const workflowType =
    selection && selection.experimentId === experimentId ? selection.workflowType : WorkflowType.MACHINE_LEARNING;

  const contextValue = useMemo(
    () => ({
      workflowType,
      setWorkflowType: (newWorkflowType: WorkflowType) => setSelection({ experimentId, workflowType: newWorkflowType }),
      onUnsupportedTab,
    }),
    [workflowType, experimentId, onUnsupportedTab],
  );

  return <LockedWorkflowSwitchContext.Provider value={contextValue}>{children}</LockedWorkflowSwitchContext.Provider>;
};

export const useLockedWorkflowSwitch = () => useContext(LockedWorkflowSwitchContext);
