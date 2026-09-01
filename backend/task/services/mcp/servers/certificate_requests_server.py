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
from task.models import CertificateRequest

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
                        "serverInfo": {"name": "CertificateRequestsServer", "version": "1.0"}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": [
                            {
                                "name": "create_certificate_request",
                                "description": "Create a new certificate request (e.g. Migration, Transfer, Character certificate).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "certificate_type": {"type": "string", "description": "Type of certificate request"},
                                        "reason": {"type": "string", "description": "Reason for the certificate request"}
                                    },
                                    "required": ["certificate_type"]
                                }
                            },
                            {
                                "name": "list_certificate_requests",
                                "description": "List all certificate requests created by the user.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "get_certificate_request",
                                "description": "Get details of a specific certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
                                }
                            },
                            {
                                "name": "get_certificate_status",
                                "description": "Get current approval or issuance status of a certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
                                }
                            },
                            {
                                "name": "cancel_certificate_request",
                                "description": "Cancel a pending certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
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
                        elif tool_name == "create_certificate_request":
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot submit certificate requests."}], "isError": True}
                            else:
                                from task.services.request_service import RequestService
                                cert_type = arguments.get("certificate_type") or "Bonafide Certificate"
                                reason = arguments.get("reason") or "Academic / Institutional Purpose"
                                
                                ws_req = RequestService.create_request(
                                    workspace=workspace,
                                    requester=user,
                                    request_type='CERTIFICATE',
                                    title=f"Certificate Request: {cert_type}",
                                    description=reason,
                                    payload={"certificate_type": cert_type, "reason": reason}
                                )
                                
                                # Maintain backwards-compatible legacy record
                                CertificateRequest.objects.create(
                                    workspace=workspace,
                                    user=user,
                                    certificate_type=cert_type,
                                    description=reason,
                                    status='PENDING'
                                )
                                text = (
                                    f"Successfully submitted certificate request for organizational approval.\n"
                                    f"Case Reference ID: {ws_req.display_id}\n"
                                    f"Type: {cert_type}\n"
                                    f"Status: SUBMITTED (Awaiting Admin/Owner Review in Review Center)\n"
                                    f"Reason: {reason or 'Not specified'}"
                                )
                                result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "list_certificate_requests":
                            from task.models import WorkspaceRequest
                            if user_role in ['ADMIN', 'OWNER']:
                                reqs = WorkspaceRequest.objects.filter(workspace=workspace, request_type='CERTIFICATE', is_archived=False)
                            else:
                                reqs = WorkspaceRequest.objects.filter(workspace=workspace, requester=user, request_type='CERTIFICATE', is_archived=False)
                            if reqs.exists():
                                lines = [f"- {r.display_id}: {r.title} [{r.decision_status}] (by @{r.requester.username})" for r in reqs]
                                text = "Certificate requests:\n" + "\n".join(lines)
                            else:
                                text = "No certificate requests found."
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name in ["get_certificate_request", "get_certificate_status"]:
                            from task.models import WorkspaceRequest
                            request_id = arguments.get("request_id")
                            try:
                                from django.db.models import Q
                                if user_role in ['ADMIN', 'OWNER']:
                                    r = WorkspaceRequest.objects.get(Q(id=request_id) | Q(display_id=request_id), workspace=workspace)
                                else:
                                    r = WorkspaceRequest.objects.get(Q(id=request_id) | Q(display_id=request_id), workspace=workspace, requester=user)
                                evidence_info = f"\nEvidence: {json.dumps(r.execution_evidence)}" if r.execution_evidence else ""
                                text = (
                                    f"Certificate Request Details:\n"
                                    f"Display ID: {r.display_id}\n"
                                    f"Title: {r.title}\n"
                                    f"Description: {r.description}\n"
                                    f"Decision Status: {r.decision_status}\n"
                                    f"Execution Status: {r.execution_status}\n"
                                    f"Requester: @{r.requester.username}\n"
                                    f"Created: {r.created_at.isoformat()}"
                                    f"{evidence_info}"
                                )
                            except Exception:
                                # Fallback search in legacy table
                                try:
                                    if user_role in ['ADMIN', 'OWNER']:
                                        r = CertificateRequest.objects.get(id=request_id, workspace=workspace)
                                    else:
                                        r = CertificateRequest.objects.get(id=request_id, workspace=workspace, user=user)
                                    text = f"Certificate Request Details:\nID: {r.id}\nType: {r.certificate_type}\nDescription: {r.description}\nStatus: {r.status}\nCreated: {r.created_at.isoformat()}"
                                except Exception:
                                    text = f"Error: Certificate request with ID '{request_id}' not found."
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "cancel_certificate_request":
                            from task.models import WorkspaceRequest
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot cancel certificate requests."}], "isError": True}
                            else:
                                request_id = arguments.get("request_id")
                                try:
                                    from django.db.models import Q
                                    if user_role in ['ADMIN', 'OWNER']:
                                        r = WorkspaceRequest.objects.get(Q(id=request_id) | Q(display_id=request_id), workspace=workspace)
                                    else:
                                        r = WorkspaceRequest.objects.get(Q(id=request_id) | Q(display_id=request_id), workspace=workspace, requester=user)
                                    
                                    if r.decision_status == 'SUBMITTED':
                                        r.decision_status = 'REJECTED'
                                        r.decision_reason = "Cancelled by requester."
                                        r.save()
                                        text = f"Successfully cancelled certificate request {r.display_id}."
                                    else:
                                        text = f"Cannot cancel request {r.display_id} because current decision status is {r.decision_status}."
                                except Exception:
                                    text = f"Error: Certificate request with ID '{request_id}' not found."
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
