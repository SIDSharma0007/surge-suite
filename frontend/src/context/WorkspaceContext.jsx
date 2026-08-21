import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { workspaceServices } from '../services/workspaceServices';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext();

const ACTIVE_WS_KEY = 'surge_active_workspace_id';

export function WorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [archivedWorkspaces, setArchivedWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem(ACTIVE_WS_KEY) || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setArchivedWorkspaces([]);
      setActiveWorkspaceId('');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [activeRes, archivedRes] = await Promise.all([
        workspaceServices.list(),
        workspaceServices.listArchived()
      ]);

      const activeList = Array.isArray(activeRes.data) ? activeRes.data : [];
      const archivedList = Array.isArray(archivedRes.data) ? archivedRes.data : [];

      setWorkspaces(activeList);
      setArchivedWorkspaces(archivedList);

      // Validate or auto-select active workspace
      setActiveWorkspaceId((prevId) => {
        const stillExists = activeList.some((ws) => ws.id === prevId);
        if (stillExists) {
          return prevId;
        }
        if (activeList.length > 0) {
          const defaultId = activeList[0].id;
          localStorage.setItem(ACTIVE_WS_KEY, defaultId);
          return defaultId;
        }
        localStorage.removeItem(ACTIVE_WS_KEY);
        return '';
      });
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to fetch workspaces.';
      setError(errorMsg);
      console.error('[WorkspaceContext] fetchWorkspaces error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const selectWorkspace = useCallback((id) => {
    const target = workspaces.find((ws) => ws.id === id);
    if (target) {
      setActiveWorkspaceId(id);
      localStorage.setItem(ACTIVE_WS_KEY, id);
      clearError();
    } else {
      console.warn(`[WorkspaceContext] Workspace with ID ${id} not found.`);
    }
  }, [workspaces, clearError]);

  const createWorkspace = useCallback(async (name) => {
    if (!name || !name.trim()) {
      setError('Workspace name cannot be empty.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await workspaceServices.create({ name: name.trim() });
      const newWorkspace = res.data;
      setWorkspaces((prev) => [newWorkspace, ...prev]);
      setActiveWorkspaceId(newWorkspace.id);
      localStorage.setItem(ACTIVE_WS_KEY, newWorkspace.id);
      return newWorkspace;
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.response?.data?.detail || err?.response?.data?.name?.[0] || err?.message || 'Failed to create workspace.';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renameWorkspace = useCallback(async (id, newName) => {
    if (!newName || !newName.trim()) {
      setError('Workspace name cannot be empty.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await workspaceServices.update(id, { name: newName.trim() });
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === id ? { ...ws, name: res.data.name } : ws))
      );
      return res.data;
    } catch (err) {
      const errorMsg = err?.response?.data?.error || 'Failed to rename workspace.';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const archiveWorkspace = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await workspaceServices.archive(id);
      const archivedItem = res.data;

      setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
      setArchivedWorkspaces((prev) => [archivedItem, ...prev]);

      // If active workspace was archived, switch to the next available workspace
      setActiveWorkspaceId((prevId) => {
        if (prevId === id) {
          const remaining = workspaces.filter((ws) => ws.id !== id);
          if (remaining.length > 0) {
            localStorage.setItem(ACTIVE_WS_KEY, remaining[0].id);
            return remaining[0].id;
          }
          localStorage.removeItem(ACTIVE_WS_KEY);
          return '';
        }
        return prevId;
      });

      return archivedItem;
    } catch (err) {
      const errorMsg = err?.response?.data?.error || 'Failed to archive workspace.';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [workspaces]);

  const restoreWorkspace = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await workspaceServices.restore(id);
      const restoredItem = res.data;

      setArchivedWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
      setWorkspaces((prev) => [restoredItem, ...prev]);
      setActiveWorkspaceId(restoredItem.id);
      localStorage.setItem(ACTIVE_WS_KEY, restoredItem.id);

      return restoredItem;
    } catch (err) {
      const errorMsg = err?.response?.data?.error || 'Failed to restore workspace.';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((ws) => ws.id === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  const currentRole = useMemo(() => {
    return activeWorkspace?.role || null;
  }, [activeWorkspace]);

  const isOwner = useMemo(() => {
    return currentRole === 'OWNER';
  }, [currentRole]);

  const value = {
    workspaces,
    archivedWorkspaces,
    activeWorkspace,
    activeWorkspaceId,
    currentRole,
    isOwner,
    isLoading,
    error,
    clearError,
    fetchWorkspaces,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    archiveWorkspace,
    restoreWorkspace
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
