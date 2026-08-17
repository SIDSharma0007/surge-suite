import api from './api';

/**
 * Service methods for task and agent resources
 */
export const taskServices = {
  /**
   * List tasks for a given workspace.
   */
  list(workspaceId) {
    return api.get(`/tasks/?workspace=${workspaceId}`);
  },

  /**
   * Create a new task in a workspace.
   */
  create(workspaceId, problemStatement) {
    return api.post('/tasks/', {
      workspace: workspaceId,
      problem_statement: problemStatement
    });
  },

  /**
   * Retrieve task details, executions, and events by ID.
   */
  retrieve(id) {
    return api.get(`/tasks/${id}/`);
  },

  /**
   * Trigger synchronous execution of a task.
   */
  execute(id) {
    return api.post(`/tasks/${id}/execute/`);
  },

  /**
   * List active agents.
   */
  listAgents() {
    return api.get('/agents/');
  },

  /**
   * Retrieve details of a specific agent.
   */
  retrieveAgent(id) {
    return api.get(`/agents/${id}/`);
  }
};
