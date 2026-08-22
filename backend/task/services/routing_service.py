from .agent_registry import AgentRegistry

class RoutingService:
    """
    Service responsible for matching user problem statements to active agents
    using simple capability-based heuristics.
    """
    def __init__(self, registry=None):
        self.registry = registry or AgentRegistry()

    def route_task(self, problem_statement: str):
        statement_lower = problem_statement.lower()
        
        # Simple Phase 4 routing heuristics:
        if 'research' in statement_lower or 'explain' in statement_lower or 'what is' in statement_lower:
            req_cap = 'research'
        elif 'math' in statement_lower or 'calculate' in statement_lower or 'count' in statement_lower:
            req_cap = 'math'
        else:
            req_cap = 'general'

        agent = self.registry.find_agent_by_capability(req_cap)
        return agent, req_cap
