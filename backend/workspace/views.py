import json
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User

from .models import Workspace, WorkspaceMembership, WorkspaceSkill, WorkspaceContextItem
from .serializers import (
    WorkspaceSerializer, WorkspaceMembershipSerializer,
    WorkspaceSkillSerializer, WorkspaceContextItemSerializer, UserSerializer
)
from .permissions import (
    IsWorkspaceOwner, IsWorkspaceMember, IsAuthenticatedOr401,
    IsWorkspaceAdminOrOwner, IsWorkspaceWriter
)

class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticatedOr401]

    def get_queryset(self):
        # Return only workspaces where user is owner or member, and not archived
        user = self.request.user
        queryset = Workspace.objects.filter(
            owner=user
        ) | Workspace.objects.filter(
            memberships__user=user
        )
        # Exclude archived from normal list
        return queryset.filter(is_archived=False).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        # Concurrency control: select_for_update to lock user row
        try:
            with transaction.atomic():
                User.objects.select_for_update().get(id=user.id)
                # Count all workspaces owned by the user (including archived ones)
                owned_count = Workspace.objects.filter(owner=user).count()
                if owned_count >= 5:
                    return Response(
                        {"error": "You have reached the maximum limit of 5 owned workspaces (including archived ones)."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Save workspace
                workspace = Workspace.objects.create(
                    name=serializer.validated_data['name'],
                    owner=user
                )
        except Exception as e:
            return Response(
                {"error": f"Workspace creation failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_serializer = self.get_serializer(workspace)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        # We need to perform the retrieve with custom permissions
        instance = get_object_or_404(Workspace, pk=kwargs.get('pk'))
        
        # Check permissions manually to support 403 and 404 precisely
        self.check_object_permissions(request, instance)

        if instance.is_archived:
            return Response(
                {"error": "This workspace has been archived and cannot be normally accessed."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = get_object_or_404(Workspace, pk=kwargs.get('pk'))
        self.check_object_permissions(request, instance)

        if instance.is_archived:
            return Response(
                {"error": "Cannot update an archived workspace."},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Destructive delete is blocked
        return Response(
            {"error": "Workspaces cannot be deleted directly. Use the archive endpoint instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def get_permissions(self):
        # Determine permission based on action
        if self.action in [
            'retrieve', 'workspace_settings', 'dm',
            'skills', 'context', 'context_summary', 'remove_context', 'members'
        ]:
            return [IsAuthenticatedOr401(), IsWorkspaceMember()]
        elif self.action in ['remove_skill']:
            return [IsAuthenticatedOr401(), IsWorkspaceAdminOrOwner()]
        elif self.action in [
            'update', 'partial_update', 'destroy', 'archive', 'restore',
            'member_detail'
        ]:
            return [IsAuthenticatedOr401(), IsWorkspaceOwner()]
        return [IsAuthenticatedOr401()]

    # --- Archival & Restoration Actions ---

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def archive(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)
        if workspace.is_archived:
            return Response(
                {"error": "Workspace is already archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        now = timezone.now()
        workspace.is_archived = True
        workspace.archived_at = now
        workspace.scheduled_deletion_at = now + timedelta(days=30)
        workspace.save()

        serializer = self.get_serializer(workspace)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def restore(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        # Check deadline before restoring
        if workspace.scheduled_deletion_at and workspace.scheduled_deletion_at <= timezone.now():
            return Response(
                {"error": "This workspace has passed the 30-day recovery deadline and cannot be restored."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not workspace.is_archived:
            return Response(
                {"error": "Workspace is not archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workspace.is_archived = False
        workspace.archived_at = None
        workspace.scheduled_deletion_at = None
        workspace.save()

        serializer = self.get_serializer(workspace)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # --- Membership Management Actions ---

    @action(detail=False, methods=['get'], url_path='archived', permission_classes=[IsAuthenticatedOr401])
    def list_archived_workspaces(self, request):
        queryset = Workspace.objects.filter(
            owner=request.user,
            is_archived=True
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='users', permission_classes=[IsAuthenticatedOr401])
    def list_all_users(self, request):
        users = User.objects.exclude(id=request.user.id)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='members', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def members(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if request.method == 'GET':
            memberships = workspace.memberships.all()
            serializer = WorkspaceMembershipSerializer(memberships, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # POST: Add member (IsWorkspaceOwner check)
        if workspace.owner != request.user:
            return Response(
                {"error": "Only the workspace owner can add members."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = WorkspaceMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        role = serializer.validated_data.get('role', WorkspaceMembership.ROLE_MEMBER)

        if user == workspace.owner:
            return Response(
                {"error": "Workspace owner cannot be added as a member."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if WorkspaceMembership.objects.filter(workspace=workspace, user=user).exists():
            return Response(
                {"error": "User is already a member of this workspace."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=user,
            role=role
        )

        response_serializer = WorkspaceMembershipSerializer(membership)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'put', 'delete'], url_path=r'members/(?P<user_id>[^/.]+)', permission_classes=[IsAuthenticatedOr401, IsWorkspaceOwner])
    def member_detail(self, request, pk=None, user_id=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if str(workspace.owner.id) == str(user_id):
            action_verb = "modify the role of" if request.method in ['PATCH', 'PUT'] else "remove"
            return Response(
                {"error": f"Cannot {action_verb} the workspace owner."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = get_object_or_404(WorkspaceMembership, workspace=workspace, user_id=user_id)

        if request.method == 'DELETE':
            membership.delete()
            return Response({"success": True, "message": "Member removed successfully."}, status=status.HTTP_200_OK)

        # PATCH / PUT: Update role
        role = request.data.get('role')
        if not role:
            return Response(
                {"error": "Role is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        valid_roles = [choice[0] for choice in WorkspaceMembership.ROLE_CHOICES]
        if role not in valid_roles:
            return Response(
                {"error": f"Invalid role: '{role}'. Valid roles are: {', '.join(valid_roles)}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership.role = role
        membership.save()

        response_serializer = WorkspaceMembershipSerializer(membership)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='ai-providers', permission_classes=[IsAuthenticatedOr401])
    def ai_providers(self, request):
        registry = {
            "simulated": {
                "display_name": "Simulated",
                "models": ["dev-mock"]
            },
            "gemini": {
                "display_name": "Google AI Studio / Gemini",
                "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"]
            },
            "groq": {
                "display_name": "Groq",
                "models": ["llama-3.3-70b-versatile", "llama3-8b-8192", "mixtral-8x7b-32768"]
            },
            "nvidia_nim": {
                "display_name": "NVIDIA NIM",
                "models": [
                    "meta/llama-3.2-11b-vision-instruct",
                    "meta/llama-3.2-3b-instruct",
                    "meta/llama-3.2-1b-instruct",
                    "nvidia/llama-3.1-nemotron-70b-instruct",
                    "meta/llama-3.3-70b-instruct"
                ]
            },
            "openclaw": {
                "display_name": "OpenClaw",
                "models": ["gpt-3.5-turbo", "gpt-4"]
            },
            "opencode": {
                "display_name": "OpenCode",
                "models": ["gpt-3.5-turbo", "gpt-4"]
            }
        }
        return Response(registry, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='settings', url_name='settings', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def workspace_settings(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if request.method == 'GET':
            return Response({
                "id": str(workspace.id),
                "name": workspace.name,
                "ai_provider": workspace.ai_provider,
                "ai_model": workspace.ai_model,
                "system_prompt": workspace.system_prompt,
                "context_window_limit": workspace.context_window_limit,
                "institutional_knowledge_enabled": workspace.institutional_knowledge_enabled,
                "policy_engine_enabled": workspace.policy_engine_enabled,
                "workflow_execution_enabled": workspace.workflow_execution_enabled,
            }, status=status.HTTP_200_OK)

        # PUT/PATCH: Only ADMIN or OWNER can update workspace settings
        is_admin_or_owner = workspace.owner == request.user or workspace.memberships.filter(user=request.user, role='ADMIN').exists()
        if not is_admin_or_owner:
            return Response(
                {"error": "Permission Denied: Only workspace ADMIN or OWNER can modify workspace settings."},
                status=status.HTTP_403_FORBIDDEN
            )

        ai_provider = request.data.get("ai_provider")
        ai_model = request.data.get("ai_model")
        system_prompt = request.data.get("system_prompt")
        context_window_limit = request.data.get("context_window_limit")
        institutional_knowledge_enabled = request.data.get("institutional_knowledge_enabled")
        policy_engine_enabled = request.data.get("policy_engine_enabled")
        workflow_execution_enabled = request.data.get("workflow_execution_enabled")

        SUPPORTED_PROVIDERS = ["simulated", "gemini", "groq", "nvidia_nim", "openclaw", "opencode"]
        if ai_provider is not None:
            if ai_provider not in SUPPORTED_PROVIDERS:
                return Response(
                    {"error": f"Unsupported provider: '{ai_provider}'"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            workspace.ai_provider = ai_provider

        if ai_model is not None:
            workspace.ai_model = ai_model

        if system_prompt is not None:
            trimmed = str(system_prompt).strip()
            if not trimmed:
                return Response(
                    {"error": "System prompt cannot be empty. Please enter valid instructions."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            workspace.system_prompt = trimmed

        if context_window_limit is not None:
            try:
                workspace.context_window_limit = int(context_window_limit)
            except ValueError:
                return Response(
                    {"error": "Context window limit must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if institutional_knowledge_enabled is not None:
            workspace.institutional_knowledge_enabled = bool(institutional_knowledge_enabled)

        if policy_engine_enabled is not None:
            workspace.policy_engine_enabled = bool(policy_engine_enabled)

        if workflow_execution_enabled is not None:
            workspace.workflow_execution_enabled = bool(workflow_execution_enabled)

        workspace.save()
        return Response({
            "id": str(workspace.id),
            "name": workspace.name,
            "ai_provider": workspace.ai_provider,
            "ai_model": workspace.ai_model,
            "system_prompt": workspace.system_prompt,
            "context_window_limit": workspace.context_window_limit,
            "institutional_knowledge_enabled": workspace.institutional_knowledge_enabled,
            "policy_engine_enabled": workspace.policy_engine_enabled,
            "workflow_execution_enabled": workspace.workflow_execution_enabled,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='dm', url_name='dm', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def dm(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if workspace.is_archived:
            return Response(
                {"error": "Cannot access an archived workspace."},
                status=status.HTTP_403_FORBIDDEN
            )

        message = request.data.get("message")
        history = request.data.get("history", [])

        # Validate message
        if not message or not isinstance(message, str):
            return Response(
                {"error": "Message is required and must be a string."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(message) > 5000:
            return Response(
                {"error": "Message exceeds the maximum limit of 5000 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate history
        if not isinstance(history, list):
            return Response(
                {"error": "History must be a list of conversation turns."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(history) > 10:
            return Response(
                {"error": "History exceeds the maximum limit of 10 turns."},
                status=status.HTTP_400_BAD_REQUEST
            )

        for turn in history:
            if not isinstance(turn, dict):
                return Response(
                    {"error": "Each history turn must be an object."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            role = turn.get("role")
            content = turn.get("content")
            if role not in ["user", "assistant"]:
                return Response(
                    {"error": f"Invalid role: '{role}'. Only 'user' and 'assistant' roles are allowed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not isinstance(content, str):
                return Response(
                    {"error": "History content must be plain strings."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Ensure no nested objects/arrays in the turn dict, only "role" and "content" fields
            if set(turn.keys()) - {"role", "content"}:
                return Response(
                    {"error": "History turns can only contain 'role' and 'content' fields."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        provider_name = workspace.ai_provider or "simulated"
        model_name = workspace.ai_model or "dev-mock"

        # Resolve provider
        from task.services.model_provider import get_model_provider_by_name
        try:
            model_provider, is_real = get_model_provider_by_name(provider_name)
        except ValueError as err:
            return Response(
                {"error": f"Unsupported provider: '{provider_name}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve API credentials for real providers
        resolved_key = None
        if is_real:
            from task.models import UserProviderCredential
            from task.utils.encryption import decrypt_value
            try:
                cred = UserProviderCredential.objects.get(user=request.user, provider=provider_name)
                resolved_key = decrypt_value(cred.encrypted_api_key)
            except UserProviderCredential.DoesNotExist:
                # Fallback to workspace owner
                try:
                    cred = UserProviderCredential.objects.get(user=workspace.owner, provider=provider_name)
                    resolved_key = decrypt_value(cred.encrypted_api_key)
                except (UserProviderCredential.DoesNotExist, AttributeError):
                    resolved_key = None

                # Secondary fallback to workspace Admin
                if not resolved_key:
                    admin_memberships = workspace.memberships.filter(role='ADMIN').select_related('user')
                    for membership in admin_memberships:
                        try:
                            cred = UserProviderCredential.objects.get(user=membership.user, provider=provider_name)
                            resolved_key = decrypt_value(cred.encrypted_api_key)
                            if resolved_key:
                                break
                        except UserProviderCredential.DoesNotExist:
                            continue

                if not resolved_key:
                    return Response(
                        {"error": f"API key for '{provider_name}' is not configured. Please add it in Provider Settings."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                return Response(
                    {"error": "Failed to decrypt provider API key."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        system_instruction = (
            "You are Surge Suite's Read-Only Workspace Assistant.\n"
            "You can inspect authorized workspace information using read-only database and MCP capabilities.\n\n"
            "CRITICAL GROUNDING & SAFETY RULES:\n"
            "1. You MUST NOT:\n"
            "   - create records\n"
            "   - modify records\n"
            "   - delete records\n"
            "   - book laboratories\n"
            "   - cancel bookings\n"
            "   - escalate grievances\n"
            "   - submit grievances or certificates\n"
            "   - approve commands\n"
            "   - execute shell commands\n"
            "   - perform any other state-changing operation\n"
            "2. If the user asks for an action that changes state (e.g. 'book a lab', 'submit a complaint', 'run a command', 'create a certificate'), politely explain that DM is strictly read-only and that they must use the Task system for state-changing actions.\n"
            "3. Never invent or hallucinate workspace data. Only claim information that was obtained from an authorized database or MCP read operation.\n"
            "4. If information cannot be retrieved or no matching records exist, clearly say that no matching records were found.\n\n"
            "TOOL CALL FORMAT:\n"
            "To call a read-only tool, respond with a JSON object:\n"
            "{\n"
            "  \"tool_call\": {\n"
            "    \"name\": \"tool_name\",\n"
            "    \"arguments\": {}\n"
            "  }\n"
            "}\n\n"
            "FINAL ANSWER FORMAT:\n"
            "When you have the required workspace data (or for purely general informational conversation), provide a helpful natural-language markdown response without wrapping in a tool call JSON object."
        )
        if workspace.system_prompt and workspace.system_prompt.strip():
            system_instruction += f"\n\nWORKSPACE SPECIFIC INSTRUCTIONS:\n{workspace.system_prompt}"

        # Initialize MCP registry and ReadOnlyToolExecutor
        from task.services.mcp.registry import MCPRegistry
        from task.services.read_only_tool_executor import ReadOnlyToolExecutor
        from task.services.dm_artifact_service import DMArtifactService

        mcp_registry = MCPRegistry(user=request.user, workspace=workspace)
        try:
            mcp_registry.initialize_servers(user=request.user)
        except Exception:
            pass

        executor = ReadOnlyToolExecutor(user=request.user, workspace=workspace, mcp_registry=mcp_registry)
        available_tools = executor.get_read_only_tools()

        # Format available tools
        tool_descriptions = []
        for t in available_tools:
            tool_descriptions.append(
                f"- Tool: {t['name']}\n"
                f"  Type: {t.get('type', 'read_only')}\n"
                f"  Description: {t.get('description', '')}\n"
                f"  Arguments Schema: {json.dumps(t.get('input_schema', {}))}"
            )
        tools_block = "AVAILABLE READ-ONLY TOOLS:\n" + ("\n".join(tool_descriptions) if tool_descriptions else "None")

        try:
            context_res = ContextService.get_context(workspace.id, request.user.id)
            context_block = context_res.get("formatted_prompt_block", "")
        except Exception:
            context_block = ""

        # Construct prompt
        prompt_parts = []
        if context_block:
            prompt_parts.append(context_block)
        prompt_parts.append(tools_block)

        for turn in history:
            role_label = "User" if turn["role"] == "user" else "Assistant"
            prompt_parts.append(f"{role_label}: {turn['content']}")
        prompt_parts.append(f"User: {message}")
        prompt = "\n\n".join(prompt_parts)

        # Execution loop
        data_sources = []
        last_structured_data = None
        last_topic = "Workspace Data"
        loop_turns = []
        max_steps = 4
        step = 0
        final_message = ""
        mode_used = "READ_ONLY"

        # Check intent for direct refusal if state mutation is requested in simulated mode or prompt
        msg_lower = message.lower()
        is_mutation_prompt = any(k in msg_lower for k in [
            "book lab", "book a lab", "create a booking", "cancel booking", "cancel my booking",
            "submit grievance", "create grievance", "escalate grievance", "escalate my grievance",
            "request certificate", "create certificate", "submit certificate", "cancel certificate",
            "create maintenance", "submit maintenance ticket", "close ticket",
            "execute command", "run command", "rm ", "drop table"
        ])

        if is_mutation_prompt and not is_real:
            mcp_registry.shutdown()
            return Response({
                "message": "I can inspect and show you existing workspace records, but I cannot perform state-changing actions from DM. Please use the Tasks system for actions such as creating bookings, submitting grievances, or requesting certificates.",
                "provider": provider_name,
                "model": model_name,
                "mode": mode_used,
                "access_mode": "READ_ONLY",
                "data_sources": [],
                "artifact": None
            }, status=status.HTTP_200_OK)

        try:
            while step < max_steps:
                step += 1
                current_prompt = prompt
                if loop_turns:
                    current_prompt += "\n\n" + "\n\n".join(loop_turns)

                output, mode = model_provider.generate(
                    current_prompt,
                    system_instruction=system_instruction,
                    api_key=resolved_key,
                    model=model_name
                )
                if mode:
                    mode_used = mode

                if not output or output.startswith("Error:"):
                    # If provider failed, return 400
                    mcp_registry.shutdown()
                    return Response(
                        {"error": "Unable to reach the selected AI provider. Check your provider configuration."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Check if output contains a tool call
                tool_call_match = None
                clean_output = output.strip()

                # Try parsing raw json or code-blocked json
                import re
                json_candidates = []
                if clean_output.startswith("{") and clean_output.endswith("}"):
                    json_candidates.append(clean_output)
                
                # Regex for markdown codeblock json
                code_matches = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', clean_output, re.DOTALL)
                json_candidates.extend(code_matches)

                # Look for {"tool_call": ...} anywhere in text
                generic_match = re.search(r'\{\s*"tool_call"\s*:\s*\{.*?\}\s*\}', clean_output, re.DOTALL)
                if generic_match:
                    json_candidates.append(generic_match.group(0))

                parsed_tool_call = None
                for cand in json_candidates:
                    try:
                        data = json.loads(cand)
                        if isinstance(data, dict) and "tool_call" in data and isinstance(data["tool_call"], dict):
                            parsed_tool_call = data["tool_call"]
                            break
                    except Exception:
                        continue

                # If in simulated mode and user asked for workspace data but model didn't call tool, help guide it
                if not parsed_tool_call and not is_real:
                    if any(w in msg_lower for w in ["grievance", "complaint"]):
                        parsed_tool_call = {"name": "workspace_data.list_grievances", "arguments": {}}
                    elif any(w in msg_lower for w in ["lab", "booking", "laboratory"]):
                        parsed_tool_call = {"name": "workspace_data.list_lab_bookings", "arguments": {}}
                    elif any(w in msg_lower for w in ["certificate", "bonafide"]):
                        parsed_tool_call = {"name": "workspace_data.list_certificate_requests", "arguments": {}}
                    elif any(w in msg_lower for w in ["maintenance", "ticket", "facility"]):
                        parsed_tool_call = {"name": "workspace_data.list_maintenance_tickets", "arguments": {}}
                    elif any(w in msg_lower for w in ["task", "execution"]):
                        parsed_tool_call = {"name": "workspace_data.list_tasks", "arguments": {}}
                    elif any(w in msg_lower for w in ["approval", "approved", "pending approval"]):
                        parsed_tool_call = {"name": "workspace_data.list_approvals", "arguments": {}}
                    elif any(w in msg_lower for w in ["request", "my requests"]):
                        parsed_tool_call = {"name": "workspace_data.list_requests", "arguments": {}}

                if parsed_tool_call and step < max_steps:
                    tool_name = parsed_tool_call.get("name", "")
                    tool_args = parsed_tool_call.get("arguments", {})

                    # Track data source
                    if "." in tool_name:
                        prefix, rest = tool_name.split(".", 1)
                        if prefix == "workspace_data":
                            data_sources.append({"type": "database", "source": rest})
                        else:
                            data_sources.append({"type": "mcp", "server": prefix})
                    else:
                        data_sources.append({"type": "builtin", "tool": tool_name})

                    # Execute read-only tool
                    tool_result = executor.execute(tool_name, tool_args)
                    last_structured_data = tool_result
                    last_topic = tool_name.split(".")[-1].replace("_", " ").title()

                    loop_turns.append(f"Assistant Tool Call: {json.dumps({'tool_call': parsed_tool_call})}")
                    loop_turns.append(f"Tool Result ({tool_name}): {json.dumps(tool_result)}")
                    continue
                else:
                    # Final response reached
                    final_message = clean_output
                    break

        finally:
            mcp_registry.shutdown()

        # Handle mutation intent in simulated mode if not refused
        if is_mutation_prompt and not is_real and ("task" not in final_message.lower() and "cannot" not in final_message.lower() and "read-only" not in final_message.lower()):
            final_message = "I can inspect and show you existing workspace records, but I cannot perform state-changing actions from DM. Please use the Tasks system for actions such as creating bookings, submitting grievances, or requesting certificates."

        # If simulated mode with tool results and plain mock message was generated, produce a natural response
        if not is_real and last_structured_data and (final_message.startswith("[Simulated Response]") or not final_message):
            if "grievances" in last_structured_data:
                g_list = last_structured_data["grievances"]
                if not g_list:
                    final_message = "You have no grievances filed in this workspace."
                else:
                    final_message = f"You have {len(g_list)} grievance(s):\n" + "\n".join([f"- **{g.get('subject')}** (Status: {g.get('status')}, Dept: {g.get('department') or 'General'})" for g in g_list])
            elif "lab_bookings" in last_structured_data:
                b_list = last_structured_data["lab_bookings"]
                if not b_list:
                    final_message = "You have no laboratory bookings in this workspace."
                else:
                    final_message = f"You have {len(b_list)} laboratory booking(s):\n" + "\n".join([f"- **{b.get('lab_name')}** on {b.get('date')} ({b.get('start_time')} - {b.get('end_time')}) [Status: {b.get('status')}]" for b in b_list])
            elif "certificate_requests" in last_structured_data:
                c_list = last_structured_data["certificate_requests"]
                if not c_list:
                    final_message = "You have no certificate requests in this workspace."
                else:
                    final_message = f"You have {len(c_list)} certificate request(s):\n" + "\n".join([f"- **{c.get('certificate_type')}** (Status: {c.get('status')})" for c in c_list])
            elif "maintenance_tickets" in last_structured_data:
                m_list = last_structured_data["maintenance_tickets"]
                if not m_list:
                    final_message = "You have no maintenance tickets in this workspace."
                else:
                    final_message = f"You have {len(m_list)} maintenance ticket(s):\n" + "\n".join([f"- **{m.get('category')}** at {m.get('location')} (Status: {m.get('status')}): {m.get('description')}" for m in m_list])
            elif "tasks" in last_structured_data:
                t_list = last_structured_data["tasks"]
                if not t_list:
                    final_message = "You have no tasks in this workspace."
                else:
                    final_message = f"You have {len(t_list)} task(s) in this workspace:\n" + "\n".join([f"- Task: \"{t.get('problem_statement')}\" (Status: {t.get('status')})" for t in t_list])
            elif "approvals" in last_structured_data:
                a_list = last_structured_data["approvals"]
                if not a_list:
                    final_message = "You have no pending approval requests."
                else:
                    final_message = f"You have {len(a_list)} approval request(s):\n" + "\n".join([f"- Command: `{a.get('sanitized_display_command')}` (Status: {a.get('status')}, Reason: {a.get('reason')})" for a in a_list])
            elif "requests" in last_structured_data:
                r_list = last_structured_data["requests"]
                if not r_list:
                    final_message = "You have no institutional requests in this workspace."
                else:
                    final_message = f"You have {len(r_list)} institutional request(s):\n" + "\n".join([f"- [{r.get('display_id')}] **{r.get('title')}** ({r.get('request_type')}, Status: {r.get('decision_status')})" for r in r_list])
            elif "error" in last_structured_data:
                final_message = f"Could not retrieve data: {last_structured_data['error']}"

        # Check if user requested Markdown export
        artifact = None
        wants_export = any(k in msg_lower for k in [
            "markdown file", "as a markdown", "as markdown", "export as markdown",
            "export these", "export to markdown", "give me markdown", "download as markdown"
        ]) or request.data.get("export") is True

        if wants_export and last_structured_data:
            artifact = DMArtifactService.generate_markdown_artifact(
                last_structured_data,
                topic=last_topic
            )

        # Deduplicate data_sources by type + (source or server or tool)
        unique_sources = []
        seen_keys = set()
        for src in data_sources:
            key = tuple(sorted(src.items()))
            if key not in seen_keys:
                seen_keys.add(key)
                unique_sources.append(src)

        return Response({
            "message": final_message,
            "provider": provider_name,
            "model": model_name,
            "mode": mode_used,
            "access_mode": "READ_ONLY",
            "data_sources": unique_sources,
            "artifact": artifact
        }, status=status.HTTP_200_OK)

    # --- Workspace Skills Management Actions ---

    @action(detail=True, methods=['get', 'post'], url_path='skills', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def skills(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if workspace.is_archived:
            return Response(
                {"error": "Cannot manage skills in an archived workspace."},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method == 'GET':
            skills_qs = workspace.skills.all()
            serializer = WorkspaceSkillSerializer(skills_qs, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # POST: Create or upload skill (Admin or Owner only)
        is_admin_or_owner = workspace.owner == request.user or workspace.memberships.filter(user=request.user, role='ADMIN').exists()
        if not is_admin_or_owner:
            return Response(
                {"error": "Permission Denied: Only workspace ADMIN or OWNER can create or upload skills."},
                status=status.HTTP_403_FORBIDDEN
            )

        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            orig_name = uploaded_file.name
            if not orig_name.lower().endswith('.md'):
                return Response(
                    {"error": "Skills accept Markdown (.md) files only."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                content = uploaded_file.read().decode('utf-8')
            except Exception:
                try:
                    uploaded_file.seek(0)
                    content = uploaded_file.read().decode('latin-1')
                except Exception as e:
                    return Response(
                        {"error": f"Failed to read skill file: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            if not content.strip():
                return Response(
                    {"error": "Uploaded skill file is empty."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            name = request.data.get('name') or orig_name
            if not name.lower().endswith('.md'):
                name += '.md'
            description = request.data.get('description', '')
        else:
            name = request.data.get('name', '').strip()
            description = request.data.get('description', '')
            content = request.data.get('content', '').strip()

            if not name:
                return Response(
                    {"error": "Skill name is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not name.lower().endswith('.md'):
                name += '.md'
            if not content:
                return Response(
                    {"error": "Skill markdown content is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        skill, created = WorkspaceSkill.objects.update_or_create(
            workspace=workspace,
            name=name,
            defaults={
                'description': description,
                'content': content,
            }
        )

        serializer = WorkspaceSkillSerializer(skill)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path=r'skills/(?P<skill_id>[^/.]+)', permission_classes=[IsAuthenticatedOr401, IsWorkspaceAdminOrOwner])
    def remove_skill(self, request, pk=None, skill_id=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        skill = get_object_or_404(WorkspaceSkill, workspace=workspace, id=skill_id)
        skill.delete()
        return Response({"success": True, "message": "Skill removed successfully."}, status=status.HTTP_200_OK)

    # --- Workspace Context Management Actions ---

    @action(detail=True, methods=['get', 'post'], url_path='context', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def context(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        if workspace.is_archived:
            return Response(
                {"error": "Cannot access context in an archived workspace."},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method == 'GET':
            items = workspace.context_items.filter(is_active=True, is_archived=False)
            serializer = WorkspaceContextItemSerializer(items, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # POST: Create manual text context or upload document (Viewer blocked)
        is_viewer = workspace.owner != request.user and workspace.memberships.filter(user=request.user, role='VIEWER').exists()
        if is_viewer:
            return Response(
                {"error": "Permission Denied: Read-only VIEWER role cannot upload or add context items."},
                status=status.HTTP_403_FORBIDDEN
            )

        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            from .services.context_extractor import ContextExtractor, ContextExtractionError
            try:
                raw_bytes = uploaded_file.read()
                extraction_res = ContextExtractor.extract_from_bytes(
                    raw_bytes=raw_bytes,
                    filename=uploaded_file.name,
                    custom_mime=uploaded_file.content_type
                )
            except ContextExtractionError as err:
                return Response(
                    {"error": f"Document extraction failed: {str(err)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            name = request.data.get('name') or extraction_res['original_filename']
            context_type = request.data.get('context_type', 'REFERENCE')
            if context_type not in ['USER_CONTEXT', 'REFERENCE', 'INSTITUTIONAL_REFERENCE']:
                context_type = 'REFERENCE'

            uploaded_file.seek(0)
            context_item = WorkspaceContextItem.objects.create(
                workspace=workspace,
                creator=request.user,
                name=name,
                context_type=context_type,
                source_type='FILE_UPLOAD',
                raw_file=uploaded_file,
                original_filename=extraction_res['original_filename'],
                mime_type=extraction_res['mime_type'],
                content_hash=extraction_res['content_hash'],
                file_size=extraction_res['file_size'],
                normalized_content=extraction_res['normalized_content'],
                metadata=extraction_res['metadata'],
                verification_metadata={
                    "is_verified": False,
                    "uploaded_by": request.user.username,
                }
            )
            serializer = WorkspaceContextItemSerializer(context_item)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            # Manual text entry
            content = request.data.get('content', '').strip()
            if not content:
                return Response(
                    {"error": "Context content cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            name = request.data.get('name', '').strip() or "Manual Context"
            context_type = request.data.get('context_type', 'USER_CONTEXT')
            if context_type not in ['USER_CONTEXT', 'REFERENCE', 'INSTITUTIONAL_REFERENCE']:
                context_type = 'USER_CONTEXT'

            import hashlib
            raw_bytes = content.encode('utf-8')
            content_hash = hashlib.sha256(raw_bytes).hexdigest()

            context_item = WorkspaceContextItem.objects.create(
                workspace=workspace,
                creator=request.user,
                name=name,
                context_type=context_type,
                source_type='MANUAL_TEXT',
                original_filename="",
                mime_type="text/plain",
                content_hash=content_hash,
                file_size=len(raw_bytes),
                normalized_content=content,
                metadata={"char_count": len(content), "line_count": len(content.splitlines())},
                verification_metadata={
                    "is_verified": False,
                    "entered_by": request.user.username,
                }
            )
            serializer = WorkspaceContextItemSerializer(context_item)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'context/(?P<context_id>[^/.]+)', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def remove_context(self, request, pk=None, context_id=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        item = get_object_or_404(WorkspaceContextItem, workspace=workspace, id=context_id)

        # Check permissions: item creator, workspace ADMIN, or OWNER (VIEWER blocked)
        is_owner = workspace.owner == request.user
        is_creator = item.creator == request.user
        user_membership = workspace.memberships.filter(user=request.user).first()
        user_role = 'OWNER' if is_owner else (user_membership.role if user_membership else 'VIEWER')

        if user_role == 'VIEWER':
            return Response(
                {"error": "Permission Denied: Read-only VIEWER role cannot delete context items."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check item creator role: only OWNER can delete OWNER-created files
        item_creator_is_owner = (item.creator == workspace.owner)
        if item_creator_is_owner and not is_owner:
            return Response(
                {"error": "Permission Denied: Only the workspace OWNER can delete items created/uploaded by the OWNER."},
                status=status.HTTP_403_FORBIDDEN
            )

        item_creator_membership = workspace.memberships.filter(user=item.creator).first() if item.creator else None
        item_creator_is_admin = (item_creator_membership and item_creator_membership.role == 'ADMIN')
        if item_creator_is_admin and not is_owner and not is_creator:
            return Response(
                {"error": "Permission Denied: Only the admin creator or workspace OWNER can delete this item."},
                status=status.HTTP_403_FORBIDDEN
            )

        if not is_owner and not is_creator and user_role != 'ADMIN':
            return Response(
                {"error": "Permission Denied: Only the creator, workspace ADMIN, or OWNER can delete this context item."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Soft delete / archive
        item.is_active = False
        item.is_archived = True
        item.save()
        return Response({"success": True, "message": "Context item removed successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='context/summary', permission_classes=[IsAuthenticatedOr401, IsWorkspaceMember])
    def context_summary(self, request, pk=None):
        workspace = get_object_or_404(Workspace, pk=pk)
        self.check_object_permissions(request, workspace)

        from .services.context_service import ContextService
        context_data = ContextService.get_context(workspace.id, request.user.id)
        instructions_data = ContextService.get_workspace_instructions(workspace.id, request.user.id)
        return Response({
            "context": context_data,
            "instructions": instructions_data,
        }, status=status.HTTP_200_OK)
