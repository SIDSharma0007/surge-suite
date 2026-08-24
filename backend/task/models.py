import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from workspace.models import Workspace

class Agent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    provider = models.CharField(max_length=100) # e.g. 'gemini', 'simulated'
    model = models.CharField(max_length=100)    # e.g. 'gemini-1.5-flash', 'dev-mock'
    capabilities = models.JSONField(default=list)  # list of strings e.g. ["research"]
    status = models.CharField(
        max_length=50,
        choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')],
        default='ACTIVE'
    )
    configuration = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.provider}/{self.model})"

class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='tasks')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    problem_statement = models.TextField()
    assigned_agent = models.ForeignKey(Agent, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    status = models.CharField(
        max_length=50,
        choices=[
            ('PENDING', 'Pending'),
            ('RUNNING', 'Running'),
            ('WAITING_FOR_APPROVAL', 'Waiting for Approval'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed')
        ],
        default='PENDING'
    )
    result = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Task {self.id} - {self.status}"

class TaskExecution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='executions')
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='executions')
    status = models.CharField(
        max_length=50,
        choices=[
            ('PENDING', 'Pending'),
            ('RUNNING', 'Running'),
            ('WAITING_FOR_APPROVAL', 'Waiting for Approval'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed')
        ],
        default='PENDING'
    )
    mode = models.CharField(
        max_length=50,
        choices=[('REAL', 'Real'), ('SIMULATED', 'Simulated')],
        default='SIMULATED'
    )
    provider = models.CharField(max_length=100, null=True, blank=True)
    model = models.CharField(max_length=100, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    result = models.TextField(blank=True, null=True)
    error = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Execution {self.id} (Task: {self.task_id})"

class Action(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    execution = models.ForeignKey(TaskExecution, on_delete=models.CASCADE, related_name='actions')
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='actions')
    action_type = models.CharField(max_length=100) # e.g. 'generate_response'
    status = models.CharField(
        max_length=50,
        choices=[
            ('PENDING', 'Pending'),
            ('RUNNING', 'Running'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed')
        ],
        default='PENDING'
    )
    input_data = models.JSONField(default=dict, blank=True)
    output_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Action {self.action_type} - {self.status}"

class ExecutionEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='events')
    execution = models.ForeignKey(TaskExecution, on_delete=models.CASCADE, null=True, blank=True, related_name='events')
    event_type = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Event {self.event_type} at {self.timestamp}"

class UserProviderCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='provider_credentials')
    provider = models.CharField(max_length=100) # lowercase e.g., 'gemini', 'groq'
    encrypted_api_key = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'provider')

    def __str__(self):
        return f"{self.user.username} - {self.provider}"


class HumanApprovalRequest(models.Model):
    """
    Represents a request for human authorization before executing a shell command
    that falls under the REQUIRES_APPROVAL security tier.

    Approval is strictly scoped: command, task, execution, and workspace are
    all captured at creation time and re-verified before any execution.
    """
    APPROVAL_STATUSES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DENIED', 'Denied'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    ]
    RISK_LEVELS = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Relationships — all required for cross-validation
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='approval_requests')
    execution = models.ForeignKey(TaskExecution, on_delete=models.CASCADE, related_name='approval_requests')
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='approval_requests')
    requested_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='submitted_approvals'
    )
    action = models.ForeignKey(
        Action, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approval_requests'
    )

    # Command storage — immutable after creation
    command = models.TextField()                    # exact, raw command (never shown to frontend)
    sanitized_display_command = models.TextField()  # secrets-redacted display version

    # Human-readable context
    reason = models.TextField(blank=True)  # why the agent wants to run this
    risk = models.CharField(max_length=20, choices=RISK_LEVELS, default='MEDIUM')

    # Lifecycle
    status = models.CharField(max_length=30, choices=APPROVAL_STATUSES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_approvals'
    )

    # Execution result (populated after approved execution)
    execution_result = models.JSONField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['task', 'status']),
            models.Index(fields=['execution', 'status']),
        ]
        # Prevent more than one PENDING approval per execution at a time
        constraints = [
            models.UniqueConstraint(
                fields=['execution'],
                condition=models.Q(status='PENDING'),
                name='unique_pending_approval_per_execution'
            )
        ]

    def is_expired(self):
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        return False

    def __str__(self):
        return f"ApprovalRequest {self.id} [{self.status}] - {self.sanitized_display_command[:60]}"
