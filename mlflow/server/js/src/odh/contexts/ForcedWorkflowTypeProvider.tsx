import React, { useMemo } from 'react';
import { WorkflowTypeContext, WorkflowTypeProvider } from '../../common/contexts/WorkflowTypeContext';
import type { WorkflowType } from '../../common/contexts/WorkflowTypeContext';

// Supplies a fixed workflow type to useWorkflowType(), ignoring the URL param and localStorage.
export const ForcedWorkflowTypeProvider = ({
  workflowType,
  children,
}: {
  workflowType: WorkflowType;
  children: React.ReactNode;
}) => {
  const contextValue = useMemo(() => ({ workflowType, setWorkflowType: () => {}, isLocked: true }), [workflowType]);

  return <WorkflowTypeContext.Provider value={contextValue}>{children}</WorkflowTypeContext.Provider>;
};

// Uses the forced provider when the host passes a workflow type, and the upstream provider otherwise.
export const HostWorkflowTypeProvider = ({
  workflowType,
  children,
}: {
  workflowType?: WorkflowType;
  children: React.ReactNode;
}) =>
  workflowType ? (
    <ForcedWorkflowTypeProvider workflowType={workflowType}>{children}</ForcedWorkflowTypeProvider>
  ) : (
    <WorkflowTypeProvider>{children}</WorkflowTypeProvider>
  );
