import type {SimulationRequest, SimulationResult, SupplyChain} from './types';

type ApiSuccess<T> = {success: true; data: T};
type ApiFailure = {success: false; error: {code: string; message: string}};

export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {...(init?.body ? {'content-type': 'application/json'} : {}), ...init?.headers},
  });
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;
  if (!response.ok || !payload || payload.success === false) {
    const failure = payload && payload.success === false ? payload.error : null;
    throw new ApiError(failure?.message || 'The server returned an unreadable response.', failure?.code || 'REQUEST_FAILED', response.status);
  }
  return payload.data;
}

export const api = {
  health: () => request<{status: string}>('/api/health'),
  listSupplyChains: () => request<SupplyChain[]>('/api/supply-chains'),
  startSimulation: (supplyChainId: string, input: SimulationRequest) => request<SimulationResult>(`/api/supply-chains/${encodeURIComponent(supplyChainId)}/simulations`, {method: 'POST', body: JSON.stringify(input)}),
  getSimulation: (runId: string) => request<SimulationResult>(`/api/simulations/${encodeURIComponent(runId)}`),
};
