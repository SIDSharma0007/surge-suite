import json
from .client import MCPClient
from .config import MCP_SERVER_CONFIGS

class MCPRegistry:
    def __init__(self):
        self.clients = {}
        self.tools = {} # Maps prefixed_name -> (client, tool_info)

    def initialize_servers(self, server_names=None):
        for cfg in MCP_SERVER_CONFIGS:
            name = cfg["name"]
            if server_names is not None and name not in server_names:
                continue
            command = cfg["command"]
            try:
                client = MCPClient(name, command)
                client.start()
                
                # Perform initialize handshake
                init_res = client.send_request("initialize", {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "SurgeSuiteClient", "version": "1.0"}
                })
                
                if "error" in init_res:
                    print(f"Error initializing MCP server '{name}': {init_res['error']}")
                    client.stop()
                    continue

                # Send notifications/initialized notification
                if client.process and client.process.stdin:
                    client.process.stdin.write(json.dumps({
                        "jsonrpc": "2.0",
                        "method": "notifications/initialized"
                    }) + "\n")
                    client.process.stdin.flush()

                self.clients[name] = client
            except Exception as e:
                print(f"Failed to startup MCP server '{name}': {str(e)}")

    def discover_tools(self) -> list:
        discovered = []
        for name, client in self.clients.items():
            try:
                res = client.send_request("tools/list")
                if "error" in res:
                    print(f"Error listing tools for MCP server '{name}': {res['error']}")
                    continue
                
                result_payload = res.get("result", {})
                tools_list = result_payload.get("tools", [])
                for t in tools_list:
                    prefixed_name = f"{name}.{t['name']}"
                    tool_info = {
                        "name": prefixed_name,
                        "server": name,
                        "description": t.get("description", ""),
                        "input_schema": t.get("inputSchema", {}),
                        "type": "mcp",
                        "original_name": t["name"]
                    }
                    self.tools[prefixed_name] = (client, tool_info)
                    discovered.append(tool_info)
            except Exception as e:
                print(f"Error discovering tools for MCP server '{name}': {str(e)}")
        return discovered

    def execute_tool(self, prefixed_name: str, arguments: dict) -> dict:
        if prefixed_name not in self.tools:
            return {"error": f"Tool '{prefixed_name}' not found in MCP registry."}

        client, tool_info = self.tools[prefixed_name]
        try:
            res = client.send_request("tools/call", {
                "name": tool_info["original_name"],
                "arguments": arguments
            })
            
            if "error" in res:
                return {"error": res["error"]}

            result_payload = res.get("result", {})
            if result_payload.get("isError"):
                content_list = result_payload.get("content", [])
                error_msg = content_list[0].get("text") if content_list else "Unknown MCP server execution error."
                return {"error": error_msg}

            content_list = result_payload.get("content", [])
            if content_list and content_list[0].get("type") == "text":
                return {"result": content_list[0].get("text")}
            
            return {"error": "Invalid response payload format from MCP server."}
        except Exception as e:
            return {"error": f"Exception executing MCP tool: {str(e)}"}

    def shutdown(self):
        for name, client in self.clients.items():
            try:
                client.stop()
            except Exception as e:
                print(f"Error stopping client '{name}': {str(e)}")
        self.clients.clear()
        self.tools.clear()
class_name = "MCPRegistry"
