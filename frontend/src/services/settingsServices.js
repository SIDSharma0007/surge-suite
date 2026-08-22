import api from './api';

export const settingsServices = {
  /**
   * Retrieve list of AI providers and configuration status.
   * @returns {Promise} Axios response promise
   */
  listProviders() {
    return api.get('/settings/providers/');
  },

  /**
   * Save API Key for a specific provider.
   * @param {string} provider - Lowecase provider identifier
   * @param {string} apiKey - Plains text API Key to save
   * @returns {Promise} Axios response promise
   */
  saveProviderKey(provider, apiKey) {
    return api.post(`/settings/providers/${provider}/`, { api_key: apiKey });
  },

  /**
   * Delete API Key for a specific provider.
   * @param {string} provider - Lowecase provider identifier
   * @returns {Promise} Axios response promise
   */
  deleteProviderKey(provider) {
    return api.delete(`/settings/providers/${provider}/`);
  }
};
