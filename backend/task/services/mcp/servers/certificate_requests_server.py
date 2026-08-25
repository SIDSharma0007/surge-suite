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
                        "serverInfo": {"name": "CertificateRequestsServer", "version": "1.0"}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": [
                            {
                                "name": "create_certificate_request",
                                "description": "Create a new certificate request (e.g. Migration, Transfer, Character certificate).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "certificate_type": {"type": "string", "description": "Type of certificate request"},
                                        "reason": {"type": "string", "description": "Reason for the certificate request"}
                                    },
                                    "required": ["certificate_type"]
                                }
                            },
                            {
                                "name": "list_certificate_requests",
                                "description": "List all certificate requests created by the user.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "get_certificate_request",
                                "description": "Get details of a specific certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
                                }
                            },
                            {
                                "name": "get_certificate_status",
                                "description": "Get current approval or issuance status of a certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
                                }
                            },
                            {
                                "name": "cancel_certificate_request",
                                "description": "Cancel a pending certificate request.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "request_id": {"type": "string", "description": "Request reference ID"}
                                    },
                                    "required": ["request_id"]
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
