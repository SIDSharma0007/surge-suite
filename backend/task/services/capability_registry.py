import os
import subprocess
from django.conf import settings
from django.db import connection
from django.core.exceptions import PermissionDenied

class CapabilityRegistry:
    def __init__(self):
        self.capabilities = {}
        self.register_default_capabilities()

    def register_tool(self, name, description, schema, handler):
        self.capabilities[name] = {
            "name": name,
            "description": description,
            "schema": schema,
            "handler": handler
        }

    def discover_capabilities(self) -> list[dict]:
        return [
            {
                "name": cap["name"],
                "description": cap["description"],
                "schema": cap["schema"]
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
        # 1. filesystem.list_directory
        self.register_tool(
            name="filesystem.list_directory",
            description="List files in a directory relative to the workspace root.",
            schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "The path to list, relative to workspace root."}
                },
                "required": ["path"]
            },
            handler=self.handle_list_directory
        )

        # 2. web.search
        self.register_tool(
            name="web.search",
            description="Search the web for up-to-date information.",
            schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query."}
                },
                "required": ["query"]
            },
            handler=self.handle_web_search
        )

        # 3. database.query
        self.register_tool(
            name="database.query",
            description="Execute an approved read-only SELECT database query.",
            schema={
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "The SELECT SQL query statement to run."}
                },
                "required": ["sql"]
            },
            handler=self.handle_database_query
        )

        # 4. bash.execute (FALLBACK)
        self.register_tool(
            name="bash.execute",
            description="Execute a shell command inside the project directory. Use ONLY as a fallback.",
            schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The shell command to execute."}
                },
                "required": ["command"]
            },
            handler=self.handle_bash_execute
        )

    # --- Handlers ---
    def handle_list_directory(self, args: dict) -> dict:
        path = args.get("path", ".")
        base_dir = os.path.abspath(settings.BASE_DIR)
        target_path = os.path.abspath(os.path.join(base_dir, path))

        if not target_path.startswith(base_dir):
            raise PermissionDenied("Access denied: Path is outside the workspace root.")

        if not os.path.exists(target_path):
            return {"error": f"Path '{path}' does not exist."}

        try:
            items = os.listdir(target_path)
            files = []
            dirs = []
            for item in items:
                full_item = os.path.join(target_path, item)
                if os.path.isdir(full_item):
                    dirs.append(item)
                else:
                    files.append(item)
            return {"files": files, "directories": dirs}
        except Exception as e:
            return {"error": str(e)}

    def handle_web_search(self, args: dict) -> dict:
        query = args.get("query", "").lower()
        # Mock search results cleanly mapped to query topic
        if "ocr" in query:
            return {
                "results": [
                    {"title": "Tesseract OCR", "snippet": "An open-source optical character recognition engine supporting 100+ languages."},
                    {"title": "EasyOCR", "snippet": "A ready-to-use OCR python library including 80+ supported languages and state-of-the-art detector."},
                    {"title": "PaddleOCR", "snippet": "An OCR toolkit based on PaddlePaddle, supporting multi-language recognition."}
                ]
            }
        return {
            "results": [
                {"title": f"Search result for {query}", "snippet": "Mock search snippet containing relevant details about the target query."}
            ]
        }

    def handle_database_query(self, args: dict) -> dict:
        sql = args.get("sql", "").strip()
        sql_lower = sql.lower()

        # Security check: must start with SELECT and must not contain forbidden keywords
        if not sql_lower.startswith("select"):
            raise PermissionDenied("Access denied: Only SELECT queries are approved.")

        forbidden = ["insert", "update", "delete", "drop", "alter", "create", "replace", "truncate", "grant", "revoke"]
        for keyword in forbidden:
            # Check for keyword boundaries to avoid substring false positives
            import re
            if re.search(r'\b' + keyword + r'\b', sql_lower):
                raise PermissionDenied(f"Access denied: Destructive SQL keyword '{keyword}' is blocked.")

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql)
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                # Return limited rows to avoid overflow
                results = [dict(zip(columns, row)) for row in rows[:50]]
                return {"columns": columns, "rows": results, "row_count": len(rows)}
        except Exception as e:
            return {"error": str(e)}

    def handle_bash_execute(self, args: dict) -> dict:
        command = args.get("command", "").strip()
        
        # Obvious blocklist checks
        blocked_commands = ["rm", "sudo", "shutdown", "reboot", "mkfs", "dd", "curl", "wget", "chmod", "chown", "kill", "pkill", "systemctl", "init"]
        for b in blocked_commands:
            import re
            if re.search(r'\b' + b + r'\b', command):
                raise PermissionDenied(f"Access denied: Command '{b}' is blocked for security.")

        # Environmental security
        clean_env = os.environ.copy()
        keys_to_clear = ['SECRET_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY', 'PROVIDER_CREDENTIAL_ENCRYPTION_KEY']
        for key in keys_to_clear:
            clean_env.pop(key, None)

        try:
            # Run command with 15 second timeout, inside settings.BASE_DIR
            result = subprocess.run(
                command,
                shell=True,
                cwd=settings.BASE_DIR,
                env=clean_env,
                capture_output=True,
                text=True,
                timeout=15
            )
            return {
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except subprocess.TimeoutExpired as e:
            return {
                "error": "Process timed out after 15 seconds.",
                "stdout": e.stdout or "",
                "stderr": e.stderr or ""
            }
        except Exception as e:
            return {"error": str(e)}
