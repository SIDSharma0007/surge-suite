import os
import sys
import json
import datetime
import django

# Initialize Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
try:
    django.setup()
except Exception as e:
    sys.stderr.write(f"Django setup error: {str(e)}\n")
    sys.stderr.flush()

from django.contrib.auth.models import User
from workspace.models import Workspace
from task.models import LaboratoryBooking

def parse_flexible_date(date_str):
    if not date_str:
        return datetime.date.today()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            return datetime.datetime.strptime(str(date_str).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    raise ValueError(f"Could not parse date '{date_str}'")

def parse_flexible_time(time_str):
    if not time_str:
        return datetime.time(10, 0)
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H"):
        try:
            return datetime.datetime.strptime(str(time_str).strip(), fmt).time()
        except (ValueError, TypeError):
            continue
    raise ValueError(f"Could not parse time '{time_str}'")

def main():
    user_id = os.environ.get("SURGE_USER_ID")
    workspace_id = os.environ.get("SURGE_WORKSPACE_ID")
    user_role = os.environ.get("SURGE_USER_ROLE", "MEMBER")

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
                params = req.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})

                if not user_id or not workspace_id:
                    result = {"content": [{"type": "text", "text": "Error: User or Workspace context is missing in environment variables."}], "isError": True}
                else:
                    try:
                        workspace = Workspace.objects.get(id=workspace_id)
                        user = User.objects.get(id=user_id)
                        
                        if not workspace.workflow_execution_enabled:
                            result = {"content": [{"type": "text", "text": "Error: Institutional workflow execution is disabled for this workspace."}], "isError": True}
                        elif tool_name == "list_laboratories":
                            text = "Available Laboratories:\n- Chemistry Lab\n- Physics Lab\n- Computer Science Lab\n- Biology Lab"
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "get_lab_availability":
                            lab_name = arguments.get("lab_name")
                            date_str = arguments.get("date")
                            try:
                                target_date = parse_flexible_date(date_str)
                                bookings = LaboratoryBooking.objects.filter(workspace=workspace, lab_name__iexact=lab_name, date=target_date, status='CONFIRMED')
                                if bookings.exists():
                                    lines = [f"- Booked: {b.start_time.strftime('%H:%M')} to {b.end_time.strftime('%H:%M')}" for b in bookings]
                                    text = f"Availability for {lab_name} on {target_date.isoformat()}:\n" + "\n".join(lines)
                                else:
                                    text = f"All time slots are currently available for {lab_name} on {target_date.isoformat()}."
                            except Exception as ex:
                                text = f"Error: Invalid date format '{date_str}': {str(ex)}"
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "create_lab_booking":
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot book laboratories."}], "isError": True}
                            else:
                                from task.services.request_service import RequestService
                                lab_name = arguments.get("lab_name")
                                date_str = arguments.get("date")
                                start_str = arguments.get("start_time")
                                end_str = arguments.get("end_time")
                                
                                try:
                                    target_date = parse_flexible_date(date_str)
                                    start_t = parse_flexible_time(start_str)
                                    end_t = parse_flexible_time(end_str)
                                    
                                    if start_t >= end_t:
                                        text = "Error: Booking start_time must be earlier than end_time."
                                    else:
                                        time_slot_desc = f"{start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}"
                                        formatted_date = target_date.isoformat()

                                        # Check for overlapping confirmed bookings on the same date and laboratory
                                        conflicts = LaboratoryBooking.objects.filter(
                                            workspace=workspace,
                                            lab_name__iexact=lab_name,
                                            date=target_date,
                                            status='CONFIRMED',
                                            start_time__lt=end_t,
                                            end_time__gt=start_t
                                        )
                                        conflict_warning = ""
                                        if conflicts.exists():
                                            c_slots = [f"{c.start_time.strftime('%H:%M')}-{c.end_time.strftime('%H:%M')}" for c in conflicts]
                                            conflict_warning = f" [WARNING: Overlaps with confirmed slot(s): {', '.join(c_slots)}]"

                                        desc_text = f"Booking slot request for {lab_name} on {formatted_date} from {time_slot_desc}.{conflict_warning}"

                                        ws_req = RequestService.create_request(
                                            workspace=workspace,
                                            requester=user,
                                            request_type='LAB_BOOKING',
                                            title=f"Lab Booking: {lab_name} ({formatted_date})",
                                            description=desc_text,
                                            payload={
                                                "laboratory": lab_name,
                                                "date": formatted_date,
                                                "time_slot": time_slot_desc,
                                                "start_time": start_t.strftime("%H:%M"),
                                                "end_time": end_t.strftime("%H:%M"),
                                                "has_conflict": conflicts.exists()
                                            }
                                        )
                                        
                                        # Legacy record
                                        LaboratoryBooking.objects.create(
                                            workspace=workspace,
                                            user=user,
                                            lab_name=lab_name,
                                            date=target_date,
                                            start_time=start_t,
                                            end_time=end_t,
                                            status='PENDING' if conflicts.exists() else 'CONFIRMED'
                                        )
                                        text = (
                                            f"Successfully submitted laboratory booking request for institutional authorization.\n"
                                            f"Case Reference ID: {ws_req.display_id}\n"
                                            f"Laboratory: {lab_name}\n"
                                            f"Date: {formatted_date}\n"
                                            f"Time Slot: {time_slot_desc}\n"
                                            f"Status: SUBMITTED (Awaiting Admin/Owner Review in Review Center)"
                                            + (f"\nNotice: {conflict_warning.strip()}" if conflict_warning else "")
                                        )
                                except Exception as ex:
                                    text = f"Error: Invalid date/time formatting '{date_str}', '{start_str}', '{end_str}': {str(ex)}"
                                result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "get_lab_booking":
                            from task.models import WorkspaceRequest
                            booking_id = arguments.get("booking_id")
                            try:
                                from django.db.models import Q
                                if user_role in ['ADMIN', 'OWNER']:
                                    b = WorkspaceRequest.objects.get(Q(id=booking_id) | Q(display_id=booking_id), workspace=workspace)
                                else:
                                    b = WorkspaceRequest.objects.get(Q(id=booking_id) | Q(display_id=booking_id), workspace=workspace, requester=user)
                                evidence_info = f"\nEvidence: {json.dumps(b.execution_evidence)}" if b.execution_evidence else ""
                                text = (
                                    f"Laboratory Booking Details:\n"
                                    f"Display ID: {b.display_id}\n"
                                    f"Title: {b.title}\n"
                                    f"Description: {b.description}\n"
                                    f"Decision Status: {b.decision_status}\n"
                                    f"Execution Status: {b.execution_status}\n"
                                    f"Requester: @{b.requester.username}\n"
                                    f"Created: {b.created_at.isoformat()}"
                                    f"{evidence_info}"
                                )
                            except Exception:
                                try:
                                    if user_role in ['ADMIN', 'OWNER']:
                                        b = LaboratoryBooking.objects.get(id=booking_id, workspace=workspace)
                                    else:
                                        b = LaboratoryBooking.objects.get(id=booking_id, workspace=workspace, user=user)
                                    text = f"Laboratory Booking Details:\nID: {b.id}\nLab: {b.lab_name}\nDate: {b.date.isoformat()}\nTime: {b.start_time.strftime('%H:%M')} - {b.end_time.strftime('%H:%M')}\nStatus: {b.status}"
                                except Exception:
                                    text = f"Error: Booking with ID '{booking_id}' not found."
                            result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "cancel_lab_booking":
                            from task.models import WorkspaceRequest
                            if user_role == "VIEWER":
                                result = {"content": [{"type": "text", "text": "Permission Denied: Read-only VIEWER role cannot cancel lab bookings."}], "isError": True}
                            else:
                                booking_id = arguments.get("booking_id")
                                try:
                                    from django.db.models import Q
                                    if user_role in ['ADMIN', 'OWNER']:
                                        b = WorkspaceRequest.objects.get(Q(id=booking_id) | Q(display_id=booking_id), workspace=workspace)
                                    else:
                                        b = WorkspaceRequest.objects.get(Q(id=booking_id) | Q(display_id=booking_id), workspace=workspace, requester=user)
                                    if b.decision_status == 'SUBMITTED':
                                        b.decision_status = 'REJECTED'
                                        b.decision_reason = "Cancelled by requester."
                                        b.save()
                                        text = f"Successfully cancelled booking request {b.display_id}."
                                    else:
                                        text = f"Cannot cancel booking {b.display_id} because current decision status is {b.decision_status}."
                                except Exception:
                                    text = f"Error: Booking with ID '{booking_id}' not found."
                                result = {"content": [{"type": "text", "text": text}]}
                        elif tool_name == "list_user_bookings":
                            from task.models import WorkspaceRequest
                            if user_role in ['ADMIN', 'OWNER']:
                                bookings = WorkspaceRequest.objects.filter(workspace=workspace, request_type='LAB_BOOKING', is_archived=False)
                            else:
                                bookings = WorkspaceRequest.objects.filter(workspace=workspace, requester=user, request_type='LAB_BOOKING', is_archived=False)
                            if bookings.exists():
                                lines = [f"- {b.display_id}: {b.title} [{b.decision_status}] (by @{b.requester.username})" for b in bookings]
                                text = "Laboratory bookings:\n" + "\n".join(lines)
                            else:
                                text = "No laboratory bookings found."
                            result = {"content": [{"type": "text", "text": text}]}
                        else:
                            result = {"content": [{"type": "text", "text": f"Error: Unknown tool '{tool_name}'"}], "isError": True}
                    except Workspace.DoesNotExist:
                        result = {"content": [{"type": "text", "text": "Error: Workspace not found."}], "isError": True}
                    except User.DoesNotExist:
                        result = {"content": [{"type": "text", "text": "Error: User not found."}], "isError": True}
                    except Exception as ex:
                        result = {"content": [{"type": "text", "text": f"Error: {str(ex)}"}], "isError": True}

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
