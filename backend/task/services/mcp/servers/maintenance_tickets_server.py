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
                        "serverInfo": {"name": "MaintenanceTicketsServer", "version": "1.0"}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": [
                            {
                                "name": "create_maintenance_ticket",
                                "description": "Create a new maintenance or service request ticket for room/facility issues.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "category": {"type": "string", "description": "Category of maintenance (e.g. electrical, plumbing, HVAC)"},
                                        "description": {"type": "string", "description": "Detailed description of the issue"},
                                        "location": {"type": "string", "description": "Location of the issue (e.g. Room 102, Hostel B)"}
                                    },
                                    "required": ["category", "description", "location"]
                                }
                            },
                            {
                                "name": "list_maintenance_tickets",
                                "description": "List all maintenance tickets.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "get_maintenance_ticket",
                                "description": "Get details of a specific maintenance ticket.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "ticket_id": {"type": "string", "description": "Ticket reference ID"}
                                    },
                                    "required": ["ticket_id"]
                                }
                            },
                            {
                                "name": "update_maintenance_ticket",
                                "description": "Update details or description of a maintenance ticket.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "ticket_id": {"type": "string", "description": "Ticket reference ID"},
                                        "description": {"type": "string", "description": "Updated details"}
                                    },
                                    "required": ["ticket_id"]
                                }
                            },
                            {
                                "name": "close_maintenance_ticket",
                                "description": "Close a maintenance ticket with a closure reason.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "ticket_id": {"type": "string", "description": "Ticket reference ID"},
                                        "reason": {"type": "string", "description": "Reason for closure"}
                                    },
                                    "required": ["ticket_id"]
                                }
                            },
                            {
                                "name": "get_ticket_status",
                                "description": "Get current status of a maintenance ticket.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "ticket_id": {"type": "string", "description": "Ticket reference ID"}
                                    },
                                    "required": ["ticket_id"]
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
