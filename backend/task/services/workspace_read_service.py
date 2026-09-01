from django.core.exceptions import PermissionDenied
from django.db.models import Q
from task.models import (
    Task, TaskExecution, GrievanceEscalation, LaboratoryBooking,
    CertificateRequest, MaintenanceTicket, HumanApprovalRequest,
    WorkspaceRequest
)
from task.services.execution_service import sanitize_data

class WorkspaceReadService:
    """
    Service layer providing authorized, strictly scoped read-only queries
    for workspace institutional and task data.
    """

    @classmethod
    def _check_workspace_access(cls, user, workspace) -> str:
        """
        Validates user membership in the workspace and returns the user's role.
        Raises PermissionDenied if user does not belong to the workspace.
        """
        if not user or not workspace:
            raise PermissionDenied("Authentication and active workspace are required.")
        
        if workspace.is_archived:
            raise PermissionDenied("Cannot access records in an archived workspace.")

        if workspace.owner == user:
            return "OWNER"

        membership = workspace.memberships.filter(user=user).first()
        if membership:
            return membership.role

        raise PermissionDenied("User is not a member of this workspace.")

    @classmethod
    def list_grievances(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = GrievanceEscalation.objects.filter(workspace=workspace)
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(user=user)

        records = []
        for g in qs[:50]:
            records.append({
                "id": str(g.id),
                "subject": g.subject,
                "description": g.description,
                "department": g.department,
                "status": g.status,
                "created_at": g.created_at.isoformat(),
                "updated_at": g.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "grievances": records
        }

    @classmethod
    def list_lab_bookings(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = LaboratoryBooking.objects.filter(workspace=workspace)
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(user=user)

        records = []
        for b in qs[:50]:
            records.append({
                "id": str(b.id),
                "lab_name": b.lab_name,
                "date": b.date.isoformat() if b.date else None,
                "start_time": b.start_time.isoformat() if b.start_time else None,
                "end_time": b.end_time.isoformat() if b.end_time else None,
                "status": b.status,
                "created_at": b.created_at.isoformat(),
                "updated_at": b.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "lab_bookings": records
        }

    @classmethod
    def list_certificate_requests(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = CertificateRequest.objects.filter(workspace=workspace)
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(user=user)

        records = []
        for c in qs[:50]:
            records.append({
                "id": str(c.id),
                "certificate_type": c.certificate_type,
                "description": c.description,
                "status": c.status,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "certificate_requests": records
        }

    @classmethod
    def list_maintenance_tickets(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = MaintenanceTicket.objects.filter(workspace=workspace)
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(user=user)

        records = []
        for m in qs[:50]:
            records.append({
                "id": str(m.id),
                "category": m.category,
                "description": m.description,
                "location": m.location,
                "status": m.status,
                "created_at": m.created_at.isoformat(),
                "updated_at": m.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "maintenance_tickets": records
        }

    @classmethod
    def list_tasks(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = Task.objects.filter(workspace=workspace).order_by('-created_at')
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(creator=user)

        records = []
        for t in qs[:50]:
            records.append({
                "id": str(t.id),
                "problem_statement": t.problem_statement,
                "status": t.status,
                "result": sanitize_data(t.result),
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "tasks": records
        }

    @classmethod
    def get_task(cls, user, workspace, task_id: str) -> dict:
        role = cls._check_workspace_access(user, workspace)
        try:
            task = Task.objects.get(id=task_id, workspace=workspace)
        except (Task.DoesNotExist, ValueError):
            return {"error": f"Task '{task_id}' not found in the active workspace."}

        if role not in ["ADMIN", "OWNER"] and task.creator != user:
            raise PermissionDenied("You do not have permission to view this task.")

        executions_data = []
        for ex in task.executions.all().order_by('started_at'):
            executions_data.append({
                "id": str(ex.id),
                "status": ex.status,
                "mode": ex.mode,
                "provider": ex.provider,
                "model": ex.model,
                "execution_type": getattr(ex, 'execution_type', 'INITIAL'),
                "prompt": getattr(ex, 'prompt', ''),
                "result": sanitize_data(ex.result),
                "error": sanitize_data(ex.error),
                "started_at": ex.started_at.isoformat() if ex.started_at else None,
                "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
            })

        return {
            "id": str(task.id),
            "problem_statement": task.problem_statement,
            "status": task.status,
            "result": sanitize_data(task.result),
            "executions": executions_data,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
        }

    @classmethod
    def list_task_executions(cls, user, workspace, task_id: str) -> dict:
        role = cls._check_workspace_access(user, workspace)
        try:
            task = Task.objects.get(id=task_id, workspace=workspace)
        except (Task.DoesNotExist, ValueError):
            return {"error": f"Task '{task_id}' not found in the active workspace."}

        if role not in ["ADMIN", "OWNER"] and task.creator != user:
            raise PermissionDenied("You do not have permission to view executions for this task.")

        executions = []
        for ex in task.executions.all().order_by('started_at'):
            executions.append({
                "id": str(ex.id),
                "status": ex.status,
                "mode": ex.mode,
                "provider": ex.provider,
                "model": ex.model,
                "execution_type": getattr(ex, 'execution_type', 'INITIAL'),
                "prompt": getattr(ex, 'prompt', ''),
                "result": sanitize_data(ex.result),
                "error": sanitize_data(ex.error),
                "started_at": ex.started_at.isoformat() if ex.started_at else None,
                "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
            })
        return {
            "task_id": str(task.id),
            "count": len(executions),
            "total": len(executions),
            "executions": executions
        }

    @classmethod
    def list_approvals(cls, user, workspace) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = HumanApprovalRequest.objects.filter(workspace=workspace).order_by('-created_at')
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(requested_by=user)

        records = []
        for a in qs[:50]:
            records.append({
                "id": str(a.id),
                "task_id": str(a.task_id),
                "sanitized_display_command": a.sanitized_display_command,
                "reason": a.reason,
                "risk": a.risk,
                "status": a.status,
                "created_at": a.created_at.isoformat(),
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            })
        return {
            "count": len(records),
            "total": len(records),
            "approvals": records
        }

    @classmethod
    def list_workspace_requests(cls, user, workspace, status_filter=None) -> dict:
        role = cls._check_workspace_access(user, workspace)
        qs = WorkspaceRequest.objects.filter(workspace=workspace, is_archived=False).order_by('-created_at')
        if role not in ["ADMIN", "OWNER"]:
            qs = qs.filter(requester=user)

        if status_filter == "ongoing":
            qs = qs.filter(decision_status__in=['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'])
        elif status_filter == "approved":
            qs = qs.filter(decision_status='APPROVED')
        elif status_filter == "rejected":
            qs = qs.filter(decision_status='REJECTED')

        records = []
        for r in qs[:50]:
            records.append({
                "id": str(r.id),
                "display_id": r.display_id,
                "title": r.title,
                "request_type": r.request_type,
                "decision_status": r.decision_status,
                "execution_status": r.execution_status,
                "decision_reason": r.decision_reason,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            })
        return {
            "count": len(records),
            "total": len(records),
            "requests": records
        }
