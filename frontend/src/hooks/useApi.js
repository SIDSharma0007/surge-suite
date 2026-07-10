import { useState, useCallback } from 'react';

/**
 * A reusable hook to handle API requests with loading, success (data), and error states.
 * 
 * @param {Function} apiCall - Async function that returns an Axios promise
 * @returns {Object} { execute, data, loading, error, isSuccess }
 */
export function useApi(apiCall) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(...args);
      setData(response.data);
      return { data: response.data, error: null };
    } catch (err) {
      // Silently capture error messages without console spam
      const errMsg = err.response?.data?.message || err.message || 'API request failed';
      setError(errMsg);
      setData(null);
      return { data: null, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return {
    execute,
    data,
    loading,
    error,
    isSuccess: !loading && !error && data !== null,
  };
}
