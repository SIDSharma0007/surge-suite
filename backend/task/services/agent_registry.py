from task.models import Agent

class AgentRegistry:
    """
    Registry service responsible for discovering and selecting active agents.
    """
    def get_active_agents(self):
        return Agent.objects.filter(status='ACTIVE')

    def find_agent_by_capability(self, capability: str):
        # Finds the first active agent matching the required capability
        agents = self.get_active_agents()
        for agent in agents:
            if capability in agent.capabilities:
                return agent
        return None
