import os
import sys
import json
import django

# Initialize Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
try:
    django.setup()
except Exception as e:
    sys.stderr.write(f"Django setup error: {str(e)}\n")
    sys.stderr.flush()

from django.contrib.auth.models import User
from workspace.models import Workspace
from task.models import GrievanceEscalation

def main():
    user_id = os.environ.get("SURGE_USER_ID")
    workspace_id = os.environ.get("SURGE_WORKSPACE_ID")
    user_role = os.environ.get("SURGE_USER_ROLE", "MEMBER")

    for line in sys.stdin:
        try:
            line_str = line.strip()
            if not line_str:
                continue
            req = json.loads(line_str)
            method = req.get("method")
            msg_id = req.get("id")
            
            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "GrievanceEscalationServer", "version": "1.0"}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": [
                            {
                                "name": "create_grievance",
                                "description": "Create or raise a new grievance/complaint.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "subject": {"type": "string", "description": "Subject of the grievance"},
                                        "description": {"type": "string", "description": "Detailed description of the issue"},
                                        "department": {"type": "string", "description": "Target department for the grievance (optional)"}
                                    },
                                    "required": ["subject", "description"]
                                }
                            },
                            {
                                "name": "list_grievances",
                                "description": "List all grievances filed by the user.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "get_grievance",
                                "description": "Get details of a specific grievance.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "grievance_id": {"type": "string", "description": "Grievance reference ID"}
                                    },
                                    "required": ["grievance_id"]
                                }
                            },
                            {
                                "name": "update_grievance",
                                "description": "Update details or description of an existing grievance.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "grievance_id": {"type": "string", "description": "Grievance reference ID"},
                                        "description": {"type": "string", "description": "Updated details"}
                                    },
                                    "required": ["grievance_id"]
                                }
                            },
                            {
                                "name": "escalate_grievance",
                                "description": "Escalate a grievance to a higher authority (Admin/Owner or creator).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "grievance_id": {"type": "string", "description": "Grievance reference ID"},
                                        "reason": {"type": "string", "description": "Reason for escalation"}
                                    },
                                    "required": ["grievance_id"]
                                }
                            },
                            {
                                "name": "get_grievance_status",
                                "description": "Get current status of a grievance.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "grievance_id": {"type": "string", "description": "Grievance reference ID"}
                                    },
                                    "required": ["grievance_id"]
                                }
                            }
                        ]
                    }
                }
            elif method == "tools/call":
                params = req.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})

                if not user_id or not workspace_id:
                    result = {"content": [{"type": "text", "text": "Error: User or Workspace context is missing in environment variables."}], "isError": True}
                else:
                    try:
                        workspace = Workspace.objects.get(id=workspace_id)
                        user = User.objects.get(id=user_id)
                        
                        if not workspace.workflow_execution_enabled:
                            result = {"content": [{"type": "text", "text": "Error: Institutional workflow execution is disabled for this workspace."}], "isError": True}
                        elif tool_name == "create_grievance":
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot raise grievances."}], "isError": True}
                            else:
                                from task.services.request_service import RequestService
                                subject = arguments.get("subject") or "Institutional Grievance"
                                description = arguments.get("description") or subject
                                department = arguments.get("department") or "General Administration"
                                
                                ws_req = RequestService.create_request(
                                    workspace=workspace,
                                    requester=user,
                                    request_type='GRIEVANCE',
                                    title=f"Grievance: {subject}",
                                    description=description,
                                    payload={"subject": subject, "description": description, "department": department}
                                )
                                
                                # Legacy record
                                GrievanceEscalation.objects.create(
                                    workspace=workspace,
                                    user=user,
                                    subject=subject,
                                    description=description,
                                    department=department,
                                    status='OPEN'
                                )
                                text = (
                                    f"Successfully submitted institutional grievance for review.\n"
                                    f"Case Reference ID: {ws_req.display_id}\n"
                                    f"Subject: {subject}\n"
                                    f"Department: {department or 'General Administration'}\n"
                                    f"Status: SUBMITTED (Awaiting Admin/Owner Review in Review Center)\n"
                                    f"Description: {description}"
                                )
                                result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "list_grievances":
                            from task.models import WorkspaceRequest
                            if user_role in ['ADMIN', 'OWNER']:
                                grievances = WorkspaceRequest.objects.filter(workspace=workspace, request_type='GRIEVANCE', is_archived=False)
                            else:
                                grievances = WorkspaceRequest.objects.filter(workspace=workspace, requester=user, request_type='GRIEVANCE', is_archived=False)
                            if grievances.exists():
                                lines = [f"- {g.display_id}: {g.title} [{g.decision_status}] (by @{g.requester.username})" for g in grievances]
                                text = "Grievances:\n" + "\n".join(lines)
                            else:
                                text = "No grievances found."
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name in ["get_grievance", "get_grievance_status"]:
                            from task.models import WorkspaceRequest
                            grievance_id = arguments.get("grievance_id")
                            try:
                                from django.db.models import Q
                                if user_role in ['ADMIN', 'OWNER']:
                                    g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace)
                                else:
                                    g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace, requester=user)
                                evidence_info = f"\nEvidence: {json.dumps(g.execution_evidence)}" if g.execution_evidence else ""
                                text = (
                                    f"Grievance Details:\n"
                                    f"Display ID: {g.display_id}\n"
                                    f"Title: {g.title}\n"
                                    f"Description: {g.description}\n"
                                    f"Decision Status: {g.decision_status}\n"
                                    f"Execution Status: {g.execution_status}\n"
                                    f"Requester: @{g.requester.username}\n"
                                    f"Created: {g.created_at.isoformat()}"
                                    f"{evidence_info}"
                                )
                            except Exception:
                                try:
                                    if user_role in ['ADMIN', 'OWNER']:
                                        g = GrievanceEscalation.objects.get(id=grievance_id, workspace=workspace)
                                    else:
                                        g = GrievanceEscalation.objects.get(id=grievance_id, workspace=workspace, user=user)
                                    text = f"Grievance Details:\nID: {g.id}\nSubject: {g.subject}\nDescription: {g.description}\nDepartment: {g.department}\nStatus: {g.status}\nCreated: {g.created_at.isoformat()}"
                                except Exception:
                                    text = f"Error: Grievance with ID '{grievance_id}' not found."
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "update_grievance":
                            from task.models import WorkspaceRequest
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot update grievances."}], "isError": True}
                            else:
                                grievance_id = arguments.get("grievance_id")
                                description = arguments.get("description")
                                try:
                                    from django.db.models import Q
                                    if user_role in ['ADMIN', 'OWNER']:
                                        g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace)
                                    else:
                                        g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace, requester=user)
                                    g.description = description
                                    g.save()
                                    text = f"Successfully updated grievance {g.display_id} description."
                                except Exception:
                                    text = f"Error: Grievance with ID '{grievance_id}' not found."
                                result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "escalate_grievance":
                            from task.models import WorkspaceRequest
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot escalate grievances."}], "isError": True}
                            else:
                                grievance_id = arguments.get("grievance_id")
                                reason = arguments.get("reason", "")
                                try:
                                    from task.services.request_service import RequestService
                                    from django.db.models import Q
                                    if user_role in ['ADMIN', 'OWNER']:
                                        g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace)
                                        RequestService.escalate_request(g, user, reason=reason or "Escalated via agent action")
                                    else:
                                        g = WorkspaceRequest.objects.get(Q(id=grievance_id) | Q(display_id=grievance_id), workspace=workspace, requester=user)
                                        g.decision_status = 'ESCALATED'
                                        g.escalation_reason = reason or "Escalated by requester"
                                        g.save()
                                    text = f"Successfully escalated grievance {g.display_id} to Owner review."
                                except Exception as e:
                                    text = f"Error: Could not escalate grievance '{grievance_id}': {str(e)}"
                                result = {"content": [{"type": "text", "text": text}]}
                        else:
                            result = {"content": [{"type": "text", "text": f"Error: Unknown tool '{tool_name}'"}], "isError": True}
                    except Workspace.DoesNotExist:
                        result = {"content": [{"type": "text", "text": "Error: Workspace not found."}], "isError": True}
                    except User.DoesNotExist:
                        result = {"content": [{"type": "text", "text": "Error: User not found."}], "isError": True}
                    except Exception as ex:
                        result = {"content": [{"type": "text", "text": f"Error: {str(ex)}"}], "isError": True}

                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": result
                }
            else:
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {}
                }
                
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error: {str(e)}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()
