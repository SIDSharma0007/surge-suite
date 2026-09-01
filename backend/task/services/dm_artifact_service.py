import os
import uuid
from django.conf import settings
from task.services.execution_service import sanitize_data

class DMArtifactService:
    """
    Generates and stores sanitized Markdown artifacts from structured read-only workspace data.
    """

    @classmethod
    def generate_markdown_artifact(cls, data: dict, topic: str = "Workspace Data", filename: str = None) -> dict:
        """
        Takes structured data, generates a formatted Markdown document, saves it to
        .surge/dm-artifacts/<artifact-id>/<filename>.md, and returns the artifact info.
        """
        artifact_id = uuid.uuid4()
        clean_data = sanitize_data(data)

        # Generate markdown content
        lines = [f"# {topic}", ""]

        if isinstance(clean_data, dict):
            # Check for standard collections
            if "grievances" in clean_data and isinstance(clean_data["grievances"], list):
                lines.append(f"**Total Grievances:** {len(clean_data['grievances'])}\n")
                if clean_data["grievances"]:
                    lines.append("| Subject | Department | Status | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- |")
                    for g in clean_data["grievances"]:
                        lines.append(f"| {g.get('subject', '-')} | {g.get('department', '-')} | **{g.get('status', '-')}** | {g.get('created_at', '-')} |")
                else:
                    lines.append("_No grievances found._")
                default_filename = "grievances.md"

            elif "lab_bookings" in clean_data and isinstance(clean_data["lab_bookings"], list):
                lines.append(f"**Total Laboratory Bookings:** {len(clean_data['lab_bookings'])}\n")
                if clean_data["lab_bookings"]:
                    lines.append("| Laboratory | Date | Time Slot | Status |")
                    lines.append("| :--- | :--- | :--- | :--- |")
                    for b in clean_data["lab_bookings"]:
                        time_slot = f"{b.get('start_time', '')} - {b.get('end_time', '')}" if b.get('start_time') else "-"
                        lines.append(f"| {b.get('lab_name', '-')} | {b.get('date', '-')} | {time_slot} | **{b.get('status', '-')}** |")
                else:
                    lines.append("_No lab bookings found._")
                default_filename = "lab-bookings.md"

            elif "certificate_requests" in clean_data and isinstance(clean_data["certificate_requests"], list):
                lines.append(f"**Total Certificate Requests:** {len(clean_data['certificate_requests'])}\n")
                if clean_data["certificate_requests"]:
                    lines.append("| Certificate Type | Description | Status | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- |")
                    for c in clean_data["certificate_requests"]:
                        lines.append(f"| {c.get('certificate_type', '-')} | {c.get('description', '-')} | **{c.get('status', '-')}** | {c.get('created_at', '-')} |")
                else:
                    lines.append("_No certificate requests found._")
                default_filename = "certificate-requests.md"

            elif "maintenance_tickets" in clean_data and isinstance(clean_data["maintenance_tickets"], list):
                lines.append(f"**Total Maintenance Tickets:** {len(clean_data['maintenance_tickets'])}\n")
                if clean_data["maintenance_tickets"]:
                    lines.append("| Category | Location | Description | Status | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- | :--- |")
                    for m in clean_data["maintenance_tickets"]:
                        lines.append(f"| {m.get('category', '-')} | {m.get('location', '-')} | {m.get('description', '-')} | **{m.get('status', '-')}** | {m.get('created_at', '-')} |")
                else:
                    lines.append("_No maintenance tickets found._")
                default_filename = "maintenance-tickets.md"

            elif "tasks" in clean_data and isinstance(clean_data["tasks"], list):
                lines.append(f"**Total Tasks:** {len(clean_data['tasks'])}\n")
                if clean_data["tasks"]:
                    lines.append("| Problem Statement | Status | Result Summary | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- |")
                    for t in clean_data["tasks"]:
                        res_snippet = (t.get('result') or '-')[:100].replace('\n', ' ')
                        lines.append(f"| {t.get('problem_statement', '-')} | **{t.get('status', '-')}** | {res_snippet} | {t.get('created_at', '-')} |")
                else:
                    lines.append("_No tasks found._")
                default_filename = "tasks.md"

            elif "approvals" in clean_data and isinstance(clean_data["approvals"], list):
                lines.append(f"**Total Approvals:** {len(clean_data['approvals'])}\n")
                if clean_data["approvals"]:
                    lines.append("| Command | Reason | Risk | Status | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- | :--- |")
                    for a in clean_data["approvals"]:
                        lines.append(f"| `{a.get('sanitized_display_command', '-')}` | {a.get('reason', '-')} | {a.get('risk', '-')} | **{a.get('status', '-')}** | {a.get('created_at', '-')} |")
                else:
                    lines.append("_No approvals found._")
                default_filename = "approvals.md"

            elif "requests" in clean_data and isinstance(clean_data["requests"], list):
                lines.append(f"**Total Institutional Requests:** {len(clean_data['requests'])}\n")
                if clean_data["requests"]:
                    lines.append("| Case ID | Title | Type | Status | Created At |")
                    lines.append("| :--- | :--- | :--- | :--- | :--- |")
                    for r in clean_data["requests"]:
                        lines.append(f"| **{r.get('display_id', '-')}** | {r.get('title', '-')} | {r.get('request_type', '-')} | {r.get('decision_status', '-')} | {r.get('created_at', '-')} |")
                else:
                    lines.append("_No institutional requests found._")
                default_filename = "institutional-requests.md"

            else:
                # Generic dictionary rendering
                for k, v in clean_data.items():
                    lines.append(f"### {k.replace('_', ' ').title()}")
                    if isinstance(v, list):
                        for item in v:
                            lines.append(f"- {item}")
                    elif isinstance(v, dict):
                        for sub_k, sub_v in v.items():
                            lines.append(f"- **{sub_k}**: {sub_v}")
                    else:
                        lines.append(f"{v}")
                    lines.append("")
                default_filename = "export.md"
        else:
            lines.append(str(clean_data))
            default_filename = "export.md"

        content = "\n".join(lines)
        target_filename = filename or default_filename
        if not target_filename.endswith(".md"):
            target_filename += ".md"

        # Persist to .surge/dm-artifacts/<artifact-id>/<filename>
        try:
            base_dir = os.path.dirname(settings.BASE_DIR)
            artifact_dir = os.path.join(base_dir, '.surge', 'dm-artifacts', str(artifact_id))
            os.makedirs(artifact_dir, exist_ok=True)
            artifact_file = os.path.join(artifact_dir, target_filename)
            with open(artifact_file, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception:
            pass

        return {
            "id": str(artifact_id),
            "type": "markdown",
            "filename": target_filename,
            "content": content
        }
