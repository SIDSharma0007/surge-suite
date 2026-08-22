import api from './api';

/**
 * Service methods for workspace resources
 */
export const workspaceServices = {
  /**
   * List workspaces where the user is an owner or member.
   */
  list() {
    return api.get('/workspaces/');
  },

  /**
   * Create a new workspace.
   */
  create(data) {
    return api.post('/workspaces/', data);
  },

  /**
   * Retrieve workspace details by ID.
   */
  retrieve(id) {
    return api.get(`/workspaces/${id}/`);
  },

  /**
   * Update workspace details (owner only).
   */
  update(id, data) {
    return api.patch(`/workspaces/${id}/`, data);
  },

  /**
   * List archived workspaces owned by the user.
   */
  listArchived() {
    return api.get('/workspaces/archived/');
  },

  /**
   * Archive a workspace (owner only).
   */
  archive(id) {
    return api.post(`/workspaces/${id}/archive/`);
  },

  /**
   * Restore an archived workspace (owner only).
   */
  restore(id) {
    return api.post(`/workspaces/${id}/restore/`);
  },

  /**
   * List all other registered users (for membership allocation).
   */
  listAllUsers() {
    return api.get('/workspaces/users/');
  },

  /**
   * List members of a workspace (owner only).
   */
  listMembers(id) {
    return api.get(`/workspaces/${id}/members/`);
  },

  /**
   * Add a member to the workspace (owner only).
   */
  addMember(id, data) {
    return api.post(`/workspaces/${id}/members/`, data);
  },

  /**
   * Remove a member from the workspace (owner only).
   */
  removeMember(id, userId) {
    return api.delete(`/workspaces/${id}/members/${userId}/`);
  },

  /**
   * Retrieve centralized list of backend AI providers and their models.
   */
  listAIProviders() {
    return api.get('/workspaces/ai-providers/');
  },

  /**
   * Retrieve specific workspace settings.
   */
  getSettings(id) {
    return api.get(`/workspaces/${id}/settings/`);
  },

  /**
   * Update specific workspace settings.
   */
  updateSettings(id, data) {
    return api.patch(`/workspaces/${id}/settings/`, data);
  }
};
