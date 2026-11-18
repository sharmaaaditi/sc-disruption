import {afterEach, describe, expect, it, vi} from 'vitest';
import {api, ApiError} from './api';

afterEach(() => vi.unstubAllGlobals());

describe('simulation API client', () => {
  it('returns the data envelope for a successful request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({success: true, data: {status: 'ok'}}), {status: 200})));

    await expect(api.health()).resolves.toEqual({status: 'ok'});
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({headers: {}}));
  });

  it('turns API error envelopes into typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({success: false, error: {code: 'BAD_REQUEST', message: 'Invalid scenario'}}), {status: 400})));

    await expect(api.startSimulation('chain-1', {name: 'Test scenario', disruptions: [], config: {totalSteps: 10, replenishmentThreshold: 30, reorderBatchSize: 50}})).rejects.toMatchObject(
      new ApiError('Invalid scenario', 'BAD_REQUEST', 400),
    );
  });
});
