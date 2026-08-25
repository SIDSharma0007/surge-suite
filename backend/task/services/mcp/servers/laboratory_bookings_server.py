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
                        "serverInfo": {"name": "LaboratoryBookingsServer", "version": "1.0"}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": [
                            {
                                "name": "list_laboratories",
                                "description": "List all laboratories available for bookings.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "get_lab_availability",
                                "description": "Inspect available time slots for a laboratory on a given date.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "lab_name": {"type": "string", "description": "Name of the laboratory"},
                                        "date": {"type": "string", "description": "Date in YYYY-MM-DD format"}
                                    },
                                    "required": ["lab_name", "date"]
                                }
                            },
                            {
                                "name": "create_lab_booking",
                                "description": "Book a laboratory slot for a specific time range.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "lab_name": {"type": "string", "description": "Name of the laboratory"},
                                        "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                                        "start_time": {"type": "string", "description": "Start time (e.g. 14:00)"},
                                        "end_time": {"type": "string", "description": "End time (e.g. 16:00)"}
                                    },
                                    "required": ["lab_name", "date", "start_time", "end_time"]
                                }
                            },
                            {
                                "name": "get_lab_booking",
                                "description": "Get details of a specific laboratory booking.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "booking_id": {"type": "string", "description": "Booking reference ID"}
                                    },
                                    "required": ["booking_id"]
                                }
                            },
                            {
                                "name": "cancel_lab_booking",
                                "description": "Cancel an existing laboratory booking.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "booking_id": {"type": "string", "description": "Booking reference ID"}
                                    },
                                    "required": ["booking_id"]
                                }
                            },
                            {
                                "name": "list_user_bookings",
                                "description": "List all laboratory bookings made by the user.",
                                "inputSchema": {"type": "object", "properties": {}}
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
