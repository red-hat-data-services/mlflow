import { getFeatureEnabledSync, SERVER_FEATURE_KEYS } from '../../experiment-tracking/hooks/useServerInfo';

const GATEWAY_RESOURCE_TYPES: readonly string[] = ['gateway_secret', 'gateway_endpoint'];
const GATEWAY_WEBHOOK_ENTITIES: readonly string[] = ['BUDGET_POLICY'];

// Read at render time: MlflowRouter (and the federated ServerInfoGate) render nothing until server-info resolves.

/** Drops the AI Gateway resource types from the admin permission pickers unless server-info enables the gateway. */
export const withoutDisabledGatewayResourceTypes = <T extends string>(resourceTypes: readonly T[]): readonly T[] =>
  getFeatureEnabledSync(SERVER_FEATURE_KEYS.GATEWAY)
    ? resourceTypes
    : resourceTypes.filter((rt) => !GATEWAY_RESOURCE_TYPES.includes(rt));

/** Drops the AI Gateway webhook events (budget policies) unless server-info enables the gateway. */
export const withoutDisabledGatewayWebhookEvents = <T extends { entity: string }>(
  events: readonly T[],
): readonly T[] =>
  getFeatureEnabledSync(SERVER_FEATURE_KEYS.GATEWAY)
    ? events
    : events.filter((e) => !GATEWAY_WEBHOOK_ENTITIES.includes(e.entity));
