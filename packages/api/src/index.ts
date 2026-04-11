import { APIClient, buildQueryParams, createApiClient } from './client/createClient';
import { attachEndpoints } from './endpoints/attachEndpoints';

export { APIClient, buildQueryParams, createApiClient };

export const createFactApiClient = (options: ConstructorParameters<typeof APIClient>[0]) => {
  const client = createApiClient(options);
  return attachEndpoints(client);
};
