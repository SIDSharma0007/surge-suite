import os
import subprocess
import re
from django.conf import settings
from django.db import connection
from django.core.exceptions import PermissionDenied


class ApprovalRequiredException(Exception):
    """
    Raised when bash.execute receives a command that requires human approval
    before it may be executed (REQUIRES_APPROVAL tier).
    The command is safe enough to be considered for execution but sensitive
    enough that a human must explicitly authorize it.
    """
    def __init__(self, command: str, reason: str, risk: str = "MEDIUM"):
        self.command = command
        self.reason = reason
        self.risk = risk
        self.sanitized_display_command = self._sanitize(command)
        super().__init__(f"Command requires human approval: {command}")

    def _sanitize(self, cmd: str) -> str:
        cmd = re.sub(r'(?i)(bearer\s+)[a-zA-Z0-9_\-\.]+', r'\1••••••••', cmd)
        cmd = re.sub(r'(?i)(x-goog-api-key\s*:\s*)[a-zA-Z0-9_\-\.]+', r'\1••••••••', cmd)
        cmd = re.sub(
            r'(?i)(key|secret|password|token|auth|credential)([^a-zA-Z0-9])([a-zA-Z0-9_\-\.]+)',
            r'\1\2••••••••',
            cmd
        )
        cmd = re.sub(r'(?i)(sk-[a-zA-Z0-9]{12,})', '••••••••', cmd)
        return cmd


class CapabilityRegistry:
    def __init__(self, user=None, workspace=None):
        self.user = user
        self.workspace = workspace
        self.capabilities = {}
        self.register_default_capabilities()

    def register_tool(self, name, description, schema, handler, tool_type):
        self.capabilities[name] = {
            "name": name,
            "description": description,
            "schema": schema,
            "handler": handler,
            "type": tool_type
        }

    def discover_capabilities(self) -> list[dict]:
        return [
            {
                "name": cap["name"],
                "description": cap["description"],
                "schema": cap["schema"],
                "type": cap["type"]
            }
            for cap in self.capabilities.values()
        ]

    def execute_tool(self, name: str, arguments: dict, **kwargs) -> dict:
        if name not in self.capabilities:
            return {"error": f"Tool '{name}' is not registered."}
        try:
            handler = self.capabilities[name]["handler"]
            return handler(arguments, **kwargs)
        except ApprovalRequiredException:
            # Re-raise approval exception so the execution loop / caller can pause for HITL
            raise
        except Exception as e:
            return {"error": str(e)}

    def register_default_capabilities(self):
        # 1. builtin.database.query
        self.register_tool(
            name="builtin.database.query",
            description="Execute an approved read-only SELECT database query. (Trusted internal capability)",
            schema={
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "The SELECT SQL query statement to run."}
                },
                "required": ["sql"]
            },
            handler=self.handle_database_query,
            tool_type="builtin"
        )

        # 2. bash.execute (FALLBACK)
        self.register_tool(
            name="bash.execute",
            description=(
                "Execute a shell command inside the project directory. "
                "Use when no suitable MCP capability is available to directly satisfy the request. "
                "Some commands require human approval before execution."
            ),
            schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The shell command to execute."}
                },
                "required": ["command"]
            },
            handler=self.handle_bash_execute,
            tool_type="fallback"
        )

    # ------------------------------------------------------------------
    # Security classification
    # ------------------------------------------------------------------

    # Commands approved for automatic execution without human review.
    _SAFE_EXECUTABLES = frozenset({"echo", "ls", "git", "npm", "pwd", "whoami", "date"})

    # Commands that are useful but require explicit human authorization.
    # Only these exact executables qualify for REQUIRES_APPROVAL.
    _APPROVAL_EXECUTABLES = frozenset({"find", "grep", "cat", "head", "tail"})

    # Forbidden shell characters that make ANY command BLOCKED regardless
    # of executable name (prevents injection / subshell attacks).
    _BLOCKED_CHARS = frozenset(["$", "(", ")", "`", "\n", ">", "<"])

    # Terms that, when present anywhere in the command string, always
    # result in BLOCKED.  Covers secrets, networking, destructive ops,
    # and interpreter invocation.
    _BLOCKED_TERMS = [
        ".env", "settings.py", "shadow", "passwd", "ssh", "rsa", "fernet", "cryptography",
        "rm", "rmdir", "sudo", "su", "chmod", "chown", "mv",
        "curl", "wget", "nc", "netcat", "telnet", "scp", "ftp", "sftp", "nmap",
        "python", "node", "perl", "ruby", "bash", "sh", "zsh",
        "awk", "sed",
    ]

    def _classify_command(self, command: str) -> str:
        """
        Classify a shell command into exactly one of three security tiers.

        Returns: "SAFE" | "REQUIRES_APPROVAL" | "BLOCKED"

        Conservative: when in doubt, BLOCKED.
        """
        command_clean = command.strip()
        command_lower = command_clean.lower()

        # 1. Reject forbidden shell metacharacters
        for fc in self._BLOCKED_CHARS:
            if fc in command_clean:
                return "BLOCKED"

        # 2. Reject globally-blocked terms
        for term in self._BLOCKED_TERMS:
            if term in command_lower:
                return "BLOCKED"

        # 3. Split into sub-commands (pipes, semicolons, ampersands)
        subparts = []
        for part in re.split(r'[|&;]', command_clean):
            part = part.strip()
            if part:
                subparts.append(part)

        if not subparts:
            return "BLOCKED"

        # 4. Classify each sub-command executable
        #    Any BLOCKED part → whole pipeline BLOCKED
        #    Any REQUIRES_APPROVAL part → at least REQUIRES_APPROVAL
        highest_tier = "SAFE"
        for part in subparts:
            tokens = part.split()
            if not tokens:
                return "BLOCKED"
            exec_name = tokens[0].lower()

            if exec_name in self._SAFE_EXECUTABLES:
                pass  # remains SAFE or inherits higher tier from another part
            elif exec_name in self._APPROVAL_EXECUTABLES:
                highest_tier = "REQUIRES_APPROVAL"
            else:
                # Unknown executable → BLOCKED immediately
                return "BLOCKED"

        return highest_tier

    def _build_approval_reason(self, command: str) -> tuple[str, str]:
        """
        Build a human-readable reason and risk level for an approval request.

        Returns: (reason, risk_level)
        """
        tokens = command.strip().split()
        exec_name = tokens[0].lower() if tokens else ""

        reasons = {
            "find": (
                "The agent wants to search the filesystem for files matching specific criteria.",
                "MEDIUM"
            ),
            "grep": (
                "The agent wants to search file contents for a text pattern.",
                "MEDIUM"
            ),
            "cat": (
                "The agent wants to display the contents of a file.",
                "MEDIUM"
            ),
            "head": (
                "The agent wants to view the first lines of a file.",
                "LOW"
            ),
            "tail": (
                "The agent wants to view the last lines of a file.",
                "LOW"
            ),
        }

        if exec_name in reasons:
            return reasons[exec_name]
        return ("The agent requests execution of a shell command.", "MEDIUM")

    # ------------------------------------------------------------------
    # Tool handlers
    # ------------------------------------------------------------------

    def handle_database_query(self, args: dict, user=None, workspace=None, **kwargs) -> dict:
        resolved_user = user or self.user
        resolved_workspace = workspace or self.workspace
        if resolved_user and resolved_workspace:
            user_role = "OWNER" if resolved_workspace.owner == resolved_user else (
                resolved_workspace.memberships.filter(user=resolved_user).values_list('role', flat=True).first() or "ANONYMOUS"
            )
            if user_role not in ["ADMIN", "OWNER"]:
                raise PermissionDenied(f"Permission Denied: Users with role '{user_role}' are not authorized to run direct database queries. ADMIN or OWNER role is required.")

        sql = args.get("sql", "").strip()
        sql_lower = sql.lower()

        # Security check: must start with SELECT
        if not sql_lower.startswith("select"):
            raise PermissionDenied("Access denied: Only SELECT queries are approved.")

        # Block destructive SQL and modifications
        forbidden = [
            "insert", "update", "delete", "drop", "alter", "create", "replace",
            "truncate", "grant", "revoke", "attach", "pragma"
        ]
        for keyword in forbidden:
            if re.search(r'\b' + keyword + r'\b', sql_lower):
                raise PermissionDenied(f"Access denied: SQL keyword '{keyword}' is blocked.")

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql)
                if not cursor.description:
                    return {"columns": [], "rows": [], "row_count": 0}
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                # Enforce result-size limits (50 rows)
                results = [dict(zip(columns, row)) for row in rows[:50]]
                return {"columns": columns, "rows": results, "row_count": len(rows)}
        except Exception as e:
            return {"error": str(e)}

    def handle_bash_execute(self, args: dict, task=None, execution=None, approved=False, user=None, workspace=None, **kwargs) -> dict:
        """
        Execute a shell command using the three-tier security policy:

        SAFE              → execute automatically
        REQUIRES_APPROVAL → raise ApprovalRequiredException (caller must pause)
        BLOCKED           → raise PermissionDenied (permanently rejected)
        """
        resolved_user = user or self.user or (execution.user if execution else None) or (task.user if task else None)
        resolved_workspace = workspace or self.workspace or (execution.workspace if execution else None) or (task.workspace if task else None)
        if resolved_user and resolved_workspace:
            user_role = "OWNER" if resolved_workspace.owner == resolved_user else (
                resolved_workspace.memberships.filter(user=resolved_user).values_list('role', flat=True).first() or "ANONYMOUS"
            )
            if user_role not in ["ADMIN", "OWNER"]:
                raise PermissionDenied(f"Permission Denied: Users with role '{user_role}' are not authorized to execute shell commands. ADMIN or OWNER role is required.")

        command_clean = args.get("command", "").strip()

        tier = self._classify_command(command_clean)

        if tier == "BLOCKED":
            raise PermissionDenied(
                "Access denied: The requested command is blocked by the security policy."
            )

        if tier == "REQUIRES_APPROVAL" and not approved:
            reason, risk = self._build_approval_reason(command_clean)
            raise ApprovalRequiredException(
                command=command_clean,
                reason=reason,
                risk=risk
            )

        # SAFE — execute with hardened environment
        clean_env = os.environ.copy()
        keys_to_clear = [
            'SECRET_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY',
            'PROVIDER_CREDENTIAL_ENCRYPTION_KEY', 'DB_PASSWORD'
        ]
        for key in keys_to_clear:
            clean_env.pop(key, None)

        base_dir = os.path.abspath(settings.BASE_DIR)

        try:
            result = subprocess.run(
                command_clean,
                shell=True,
                cwd=base_dir,
                env=clean_env,
                capture_output=True,
                text=True,
                timeout=15
            )
            stdout = result.stdout[:10240]
            stderr = result.stderr[:10240]
            return {
                "exit_code": result.returncode,
                "stdout": stdout,
                "stderr": stderr
            }
        except subprocess.TimeoutExpired as e:
            stdout_timeout = (e.stdout or "")[:10240]
            stderr_timeout = (e.stderr or "")[:10240]
            return {
                "error": "Process timed out after 15 seconds.",
                "stdout": stdout_timeout,
                "stderr": stderr_timeout
            }
        except Exception as e:
            return {"error": str(e)}
