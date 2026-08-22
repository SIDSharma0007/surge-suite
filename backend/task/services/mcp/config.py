import sys
import os
from django.conf import settings

# Active python interpreter running this django process
PYTHON_EXECUTABLE = sys.executable

# Absolute paths to our subprocess python MCP servers
FILESYSTEM_SERVER_PATH = os.path.abspath(os.path.join(
    settings.BASE_DIR, 'task', 'services', 'mcp', 'servers', 'filesystem_server.py'
))

SEARCH_SERVER_PATH = os.path.abspath(os.path.join(
    settings.BASE_DIR, 'task', 'services', 'mcp', 'servers', 'search_server.py'
))

# Dynamically discoverable servers config
MCP_SERVER_CONFIGS = [
    {
        "name": "filesystem",
        "command": [PYTHON_EXECUTABLE, FILESYSTEM_SERVER_PATH]
    },
    {
        "name": "search",
        "command": [PYTHON_EXECUTABLE, SEARCH_SERVER_PATH]
    }
]
