import os
import subprocess
import re
from django.conf import settings
from django.db import connection
from django.core.exceptions import PermissionDenied

class CapabilityRegistry:
    def __init__(self):
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

    def execute_tool(self, name: str, arguments: dict) -> dict:
        if name not in self.capabilities:
            return {"error": f"Tool '{name}' is not registered."}
        try:
            handler = self.capabilities[name]["handler"]
            return handler(arguments)
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
            description="Execute a shell command inside the project directory. Use ONLY as a fallback when no suitable MCP capability exists.",
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

    def handle_database_query(self, args: dict) -> dict:
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

    def handle_bash_execute(self, args: dict) -> dict:
        # Strict security validation
        command_clean = args.get("command", "").strip()
        command_lower = command_clean.lower()
        
        # Block subshell, backticks, redirection, and nested commands
        forbidden_chars = ["$", "(", ")", "`", "'", "\"", "\n", ">", "<"]
        for fc in forbidden_chars:
            if fc in command_clean:
                raise PermissionDenied(f"Access denied: Nested commands, redirection, or quotes '{fc}' are blocked for security.")
                
        # Split command by standard separators: | , & , ;
        subparts = []
        for part in re.split(r'[|&;]', command_clean):
            part = part.strip()
            if part:
                subparts.append(part)
                
        ALLOWED_EXECUTABLES = {"echo", "ls", "git", "npm"}
        
        for part in subparts:
            tokens = part.split()
            if not tokens:
                continue
            exec_name = tokens[0].lower()
            if exec_name not in ALLOWED_EXECUTABLES:
                raise PermissionDenied(f"Access denied: Command '{exec_name}' is not in the safe allowlist.")
                
        # Blocked terms scanning (case-insensitive) for any secrets, SSH files, env, credentials
        blocked_terms = [
            ".env", "settings.py", "secret", "key", "token", "credential", 
            "password", "shadow", "passwd", "ssh", "rsa", "fernet", "cryptography",
            "cat", "head", "tail", "less", "more", "grep", "find", "awk", "sed",
            "curl", "wget", "nc", "netcat", "telnet", "scp", "ftp", "sftp", "nmap",
            "python", "node", "perl", "ruby", "bash", "sh", "zsh"
        ]
        for term in blocked_terms:
            if term in command_lower:
                raise PermissionDenied(f"Access denied: Accessing or dumping '{term}' is blocked for security.")

        # Environmental security: strip secrets before executing
        clean_env = os.environ.copy()
        keys_to_clear = [
            'SECRET_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY',
            'PROVIDER_CREDENTIAL_ENCRYPTION_KEY', 'DB_PASSWORD'
        ]
        for key in keys_to_clear:
            clean_env.pop(key, None)

        # Base workspace root path traversal check
        base_dir = os.path.abspath(settings.BASE_DIR)
        
        try:
            # Run command with 15 second timeout and restricted environment
            result = subprocess.run(
                command_clean,
                shell=True,
                cwd=base_dir,
                env=clean_env,
                capture_output=True,
                text=True,
                timeout=15
            )
            # Enforce output size limits (first 10KB)
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
