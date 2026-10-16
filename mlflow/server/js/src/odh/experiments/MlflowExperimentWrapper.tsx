import React, { useEffect, useMemo } from 'react';
import { coerceToEnum } from '@databricks/web-shared/utils';
import { Routes } from '../../common/utils/RoutingUtils';
import { WorkflowType } from '../../common/contexts/WorkflowTypeContext';
import { getExperimentTrackingRouteElements } from './experimentTrackingRoutes';
import { BreadcrumbReporter } from './BreadcrumbReporter';
import { UnsupportedTabGuard } from './UnsupportedTabGuard';
import type { UnsupportedTabInfo } from './UnsupportedTabGuard';
import MlflowWrapperBase from '@mlflow/mlflow/src/odh/wrappers/MlflowWrapperBase';
import { EXPERIMENTS_DEFAULT_BASENAME } from '../const';

const MlflowExperimentWrapper: React.FC<{
  basename?: string;
  onBreadcrumbChange?: (segments: { label: string; path: string }[]) => void;
  workflowType?: WorkflowType;
  onUnsupportedTab?: (info: UnsupportedTabInfo) => void;
}> = ({ basename = EXPERIMENTS_DEFAULT_BASENAME, onBreadcrumbChange, workflowType, onUnsupportedTab }) => {
  const validWorkflowType = coerceToEnum(WorkflowType, workflowType, undefined);
  useEffect(() => {
    if (workflowType !== undefined && !validWorkflowType) {
      // eslint-disable-next-line no-console
      console.warn(`MlflowExperimentWrapper: ignoring unknown workflowType "${String(workflowType)}"`);
    }
  }, [workflowType, validWorkflowType]);

  const routeElements = useMemo(() => getExperimentTrackingRouteElements(validWorkflowType), [validWorkflowType]);
  return (
    <MlflowWrapperBase
      basename={basename}
      workflowType={validWorkflowType}
      breadcrumbReporter={
        <BreadcrumbReporter workflowType={validWorkflowType} onBreadcrumbChange={onBreadcrumbChange} />
      }
    >
      {validWorkflowType ? (
        <UnsupportedTabGuard workflowType={validWorkflowType} onUnsupportedTab={onUnsupportedTab}>
          <Routes>{routeElements}</Routes>
        </UnsupportedTabGuard>
      ) : (
        <Routes>{routeElements}</Routes>
      )}
    </MlflowWrapperBase>
  );
};

export default MlflowExperimentWrapper;
