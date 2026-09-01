import json
from django.core.exceptions import PermissionDenied
from task.services.workspace_read_service import WorkspaceReadService
from task.services.mcp.registry import MCPRegistry, get_tool_access_level
from task.services.capability_registry import (
    CapabilityRegistry, ACCESS_READ, ACCESS_WRITE, ACCESS_DESTRUCTIVE, ACCESS_REQUIRES_APPROVAL
)

NATIVE_READ_TOOLS = {
    "workspace_data.list_grievances": {
        "name": "workspace_data.list_grievances",
        "description": "List all grievances filed by the user in the current workspace.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.list_lab_bookings": {
        "name": "workspace_data.list_lab_bookings",
        "description": "List all laboratory bookings for the user in the current workspace.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.list_certificate_requests": {
        "name": "workspace_data.list_certificate_requests",
        "description": "List all certificate requests created by the user in the current workspace.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.list_maintenance_tickets": {
        "name": "workspace_data.list_maintenance_tickets",
        "description": "List all maintenance and facility tickets for the user in the current workspace.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.list_tasks": {
        "name": "workspace_data.list_tasks",
        "description": "List recent tasks in the current workspace with their status and result summaries.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.get_task": {
        "name": "workspace_data.get_task",
        "description": "Get detailed information and execution history for a specific task by task_id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The UUID of the task to inspect"}
            },
            "required": ["task_id"]
        },
        "access": ACCESS_READ
    },
    "workspace_data.list_task_executions": {
        "name": "workspace_data.list_task_executions",
        "description": "List all execution attempts, errors, and outcomes for a specific task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The UUID of the task"}
            },
            "required": ["task_id"]
        },
        "access": ACCESS_READ
    },
    "workspace_data.list_approvals": {
        "name": "workspace_data.list_approvals",
        "description": "List human approval requests and their statuses in the current workspace.",
        "input_schema": {"type": "object", "properties": {}},
        "access": ACCESS_READ
    },
    "workspace_data.list_requests": {
        "name": "workspace_data.list_requests",
        "description": "List institutional requests and their lifecycle decision statuses.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status_filter": {
                    "type": "string",
                    "enum": ["all", "ongoing", "approved", "rejected"],
                    "description": "Optional filter for request status"
                }
            }
        },
        "access": ACCESS_READ
    }
}

class ReadOnlyToolExecutor:
    """
    Strict security boundary for executing read-only database queries and MCP tools.
    Rejects any mutation, destructive action, shell execution, or approval-tier operation.
    """

    def __init__(self, user, workspace, mcp_registry=None):
        self.user = user
        self.workspace = workspace
        self.mcp_registry = mcp_registry or MCPRegistry(user=user, workspace=workspace)

    def get_read_only_tools(self) -> list[dict]:
        """
        Discovers all available capabilities that satisfy access == READ
        and user has permission.
        """
        tools = []
        # 1. Native WorkspaceReadService tools
        for tool_def in NATIVE_READ_TOOLS.values():
            tools.append({
                "name": tool_def["name"],
                "description": tool_def["description"],
                "input_schema": tool_def["input_schema"],
                "type": "native_database",
                "access": ACCESS_READ
            })

        # 2. Builtin CapabilityRegistry read tools (e.g. requests.list_my_requests)
        cap_reg = CapabilityRegistry(user=self.user, workspace=self.workspace)
        for cap in cap_reg.discover_capabilities():
            if cap.get("access") == ACCESS_READ and cap["name"] != "builtin.database.query":
                tools.append({
                    "name": cap["name"],
                    "description": cap["description"],
                    "input_schema": cap["schema"],
                    "type": "builtin",
                    "access": ACCESS_READ
                })

        # 3. MCP Read Tools
        if self.mcp_registry:
            discovered_mcp = self.mcp_registry.discover_tools()
            for mcp_tool in discovered_mcp:
                if mcp_tool.get("access") == ACCESS_READ:
                    tools.append(mcp_tool)

        return tools

    def execute(self, tool_name: str, arguments: dict) -> dict:
        """
        Validates that tool_name is classified as READ and executes it.
        If tool modifies state or requires approval, rejects immediately.
        """
        # Block raw shell or prohibited tools
        if tool_name in ["bash.execute", "builtin.database.query"]:
            return {
                "error": "This action changes workspace state and cannot be performed through DM."
            }

        # Check native read tools
        if tool_name in NATIVE_READ_TOOLS:
            return self._execute_native(tool_name, arguments or {})

        # Check CapabilityRegistry tools
        if tool_name.startswith("requests."):
            if tool_name == "requests.create_request":
                return {
                    "error": "This action changes workspace state and cannot be performed through DM."
                }
            cap_reg = CapabilityRegistry(user=self.user, workspace=self.workspace)
            if tool_name in cap_reg.capabilities:
                cap_info = cap_reg.capabilities[tool_name]
                if cap_info.get("access") != ACCESS_READ:
                    return {
                        "error": "This action changes workspace state and cannot be performed through DM."
                    }
                try:
                    return cap_reg.execute_tool(tool_name, arguments or {})
                except Exception as e:
                    return {"error": str(e)}

        # Check MCP tools
        access_level = get_tool_access_level(tool_name)
        if access_level != ACCESS_READ:
            return {
                "error": "This action changes workspace state and cannot be performed through DM."
            }

        # Execute through MCP registry
        try:
            return self.mcp_registry.execute_tool(tool_name, arguments or {})
        except PermissionDenied as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to execute read tool: {str(e)}"}

    def _execute_native(self, tool_name: str, arguments: dict) -> dict:
        try:
            if tool_name == "workspace_data.list_grievances":
                return WorkspaceReadService.list_grievances(self.user, self.workspace)
            elif tool_name == "workspace_data.list_lab_bookings":
                return WorkspaceReadService.list_lab_bookings(self.user, self.workspace)
            elif tool_name == "workspace_data.list_certificate_requests":
                return WorkspaceReadService.list_certificate_requests(self.user, self.workspace)
            elif tool_name == "workspace_data.list_maintenance_tickets":
                return WorkspaceReadService.list_maintenance_tickets(self.user, self.workspace)
            elif tool_name == "workspace_data.list_tasks":
                return WorkspaceReadService.list_tasks(self.user, self.workspace)
            elif tool_name == "workspace_data.get_task":
                task_id = arguments.get("task_id", "").strip()
                if not task_id:
                    return {"error": "task_id is required."}
                return WorkspaceReadService.get_task(self.user, self.workspace, task_id)
            elif tool_name == "workspace_data.list_task_executions":
                task_id = arguments.get("task_id", "").strip()
                if not task_id:
                    return {"error": "task_id is required."}
                return WorkspaceReadService.list_task_executions(self.user, self.workspace, task_id)
            elif tool_name == "workspace_data.list_approvals":
                return WorkspaceReadService.list_approvals(self.user, self.workspace)
            elif tool_name == "workspace_data.list_requests":
                status_filter = arguments.get("status_filter", "all")
                return WorkspaceReadService.list_workspace_requests(self.user, self.workspace, status_filter)
            else:
                return {"error": f"Unknown native tool '{tool_name}'."}
        except PermissionDenied as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": str(e)}
