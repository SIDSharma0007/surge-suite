import React, { useEffect, useCallback } from 'react';
import api from '../services/api';
import { useApi } from '../hooks/useApi';

function Landing() {
  // Memoize the API function call to maintain a stable reference
  const getStatus = useCallback(() => api.get('/status/'), []);

  // useApi hook handles loading, error, and data (success) states
  const { execute: checkStatus, data, loading, error } = useApi(getStatus);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Derive the display status from hook state
  let displayStatus = 'Checking...';
  if (!loading) {
    if (error) {
      displayStatus = 'Offline';
    } else if (data && data.status === 'online') {
      displayStatus = 'Online';
    } else {
      displayStatus = 'Offline';
    }
  }

  return (
    <div>
      <h1>Landing</h1>
      <p>Backend Status: {displayStatus}</p>
    </div>
  );
}

export default Landing;
