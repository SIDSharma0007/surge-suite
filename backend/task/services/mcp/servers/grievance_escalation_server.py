import sys
import json

def main():
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
                                "description": "Escalate a grievance to a higher authority.",
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
                result = {
                    "content": [
                        {
                            "type": "text",
                            "text": "Error: The institutional backend connection is currently inactive. This tool is registered/discoverable but the underlying API or database is not connected."
                        }
                    ],
                    "isError": True
                }
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
