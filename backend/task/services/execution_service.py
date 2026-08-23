from django.utils import timezone
from task.models import Task, TaskExecution, Action, ExecutionEvent
from .model_provider import RealGeminiModelProvider, FakeModelProvider
import json
import re

def sanitize_data(data, sensitive_key=None):
    """
    Recursively redacts sensitive info (API keys, authorization headers, credentials)
    from dictionary, list, or string structures before persisting to database.
    """
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            k_lower = k.lower()
            if any(term in k_lower for term in ['key', 'secret', 'password', 'token', 'authorization', 'credential', 'auth']):
                sanitized[k] = "••••••••"
            else:
                sanitized[k] = sanitize_data(v, sensitive_key)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_data(item, sensitive_key) for item in data]
    elif isinstance(data, str):
        # Redact the resolved provider API key if present
        if sensitive_key and sensitive_key in data:
            data = data.replace(sensitive_key, "••••••••")
        
        # Redact Bearer tokens, API keys, x-goog-api-key values
        data = re.sub(r'(?i)(bearer\s+)[a-zA-Z0-9_\-\.]+', r'\1••••••••', data)
        data = re.sub(r'(?i)(x-goog-api-key\s*:\s*)[a-zA-Z0-9_\-\.]+', r'\1••••••••', data)
        return data
    else:
        return data

class ExecutionService:
    """
    Service responsible for orchestrating task executions, calling the model
    provider, persisting Action attempts, and recording ExecutionEvents.
    """
    def __init__(self, provider=None):
        # Defaults to the RealGeminiModelProvider, but allows FakeModelProvider injection
        self.provider = provider or RealGeminiModelProvider()

    def execute_task(self, task, user=None):
        if not task.assigned_agent:
            task.status = 'FAILED'
            task.save()
            ExecutionEvent.objects.create(
                task=task,
                event_type='EXECUTION_FAILED',
                metadata={'error': 'Cannot execute task: No agent is assigned.'}
            )
            return None

        agent = task.assigned_agent
        
        # Determine the model provider to use.
        # If execution service was initialized with a specific provider override (e.g. FakeModelProvider for tests), we use it.
        # Otherwise, we resolve it based on agent.provider.
        is_override = self.provider and not isinstance(self.provider, RealGeminiModelProvider)
        
        if is_override:
            model_provider = self.provider
            is_real = not isinstance(self.provider, FakeModelProvider)
            provider_name = 'simulated'
            model_name = 'dev-mock'
            resolved_key = None
        else:
            workspace = task.workspace
            provider_name = workspace.ai_provider or 'simulated'
            model_name = workspace.ai_model or 'dev-mock'
            
            from .model_provider import get_model_provider_by_name
            try:
                model_provider, is_real = get_model_provider_by_name(provider_name)
            except ValueError as err:
                task.status = 'FAILED'
                task.save()
                
                execution = TaskExecution.objects.create(
                    task=task,
                    agent=agent,
                    status='FAILED',
                    mode='REAL',
                    provider=provider_name,
                    model=model_name,
                    error=str(err)
                )
                
                ExecutionEvent.objects.create(
                    task=task,
                    execution=execution,
                    event_type='EXECUTION_FAILED',
                    metadata=sanitize_data({'error': str(err)})
                )
                return execution
            
            # Resolve key for real providers
            if is_real:
                from task.models import UserProviderCredential
                from task.utils.encryption import decrypt_value
                
                target_user = user or task.creator
                try:
                    cred = UserProviderCredential.objects.get(user=target_user, provider=provider_name.lower())
                    resolved_key = decrypt_value(cred.encrypted_api_key)
                except UserProviderCredential.DoesNotExist:
                    resolved_key = None
                    
                if not resolved_key:
                    # Key is missing!
                    task.status = 'FAILED'
                    task.save()
                    
                    execution = TaskExecution.objects.create(
                        task=task,
                        agent=agent,
                        status='FAILED',
                        mode='REAL',
                        provider=provider_name,
                        model=model_name,
                        error=f"Configure this provider under Settings → AI Providers."
                    )
                    
                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='EXECUTION_FAILED',
                        metadata=sanitize_data({'error': f"Configure this provider under Settings → AI Providers."})
                    )
                    return execution
            else:
                resolved_key = None

        # Transition Task to RUNNING state
        task.status = 'RUNNING'
        task.save()

        # Create TaskExecution record
        execution = TaskExecution.objects.create(
            task=task,
            agent=agent,
            status='RUNNING',
            mode='REAL' if is_real else 'SIMULATED',
            provider=provider_name,
            model=model_name
        )

        from .mcp.registry import MCPRegistry
        from .capability_registry import CapabilityRegistry

        # Log EXECUTION_STARTED event
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='EXECUTION_STARTED',
            metadata=sanitize_data({'agent_id': str(agent.id), 'mode': execution.mode}, resolved_key)
        )

        # Log MCP_DISCOVERY_STARTED
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='MCP_DISCOVERY_STARTED',
            metadata=sanitize_data({'message': 'Discovering dynamic MCP tools...'}, resolved_key)
        )

        mcp_registry = MCPRegistry()
        try:
            mcp_registry.initialize_servers()
            mcp_tools = mcp_registry.discover_tools()
        except Exception as e:
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_FAILED',
                metadata=sanitize_data({'error': f"MCP Initialization failed: {str(e)}"}, resolved_key)
            )
            task.status = 'FAILED'
            task.result = f"MCP Initialization failed: {str(e)}"
            task.save()
            
            execution.status = 'FAILED'
            execution.error = f"MCP Initialization failed: {str(e)}"
            execution.completed_at = timezone.now()
            execution.save()
            
            mcp_registry.shutdown()
            return execution

        # Log MCP_DISCOVERY_COMPLETED
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='MCP_DISCOVERY_COMPLETED',
            metadata=sanitize_data({'tools_discovered': [t['name'] for t in mcp_tools]}, resolved_key)
        )

        builtin_registry = CapabilityRegistry()
        builtin_capabilities = builtin_registry.discover_capabilities()

        # Format MCP capabilities
        mcp_cap_texts = []
        for t in mcp_tools:
            mcp_cap_texts.append(
                f"- Tool: {t['name']}\n"
                f"  Type: mcp\n"
                f"  Server: {t['server']}\n"
                f"  Description: {t['description']}\n"
                f"  Arguments Schema: {json.dumps(t['input_schema'])}"
            )

        # Format Builtin / Fallback capabilities
        builtin_cap_texts = []
        for c in builtin_capabilities:
            builtin_cap_texts.append(
                f"- Tool: {c['name']}\n"
                f"  Type: {c['type']}\n"
                f"  Description: {c['description']}\n"
                f"  Arguments Schema: {json.dumps(c['schema'])}"
            )

        capabilities_text = "AVAILABLE MCP TOOLS:\n" + ("\n".join(mcp_cap_texts) if mcp_cap_texts else "None") + "\n\n"
        capabilities_text += "AVAILABLE BUILTIN & FALLBACK TOOLS:\n" + ("\n".join(builtin_cap_texts) if builtin_cap_texts else "None")

        system_instruction = (
            "You are the Surge Suite task agent. Complete the user's task using the capabilities available to you.\n"
            "MCP tools are preferred. Fallback tools should only be used when no suitable MCP capability exists.\n"
            "Do NOT automatically invoke bash/fallback merely because an MCP tool failed.\n"
            "If an MCP tool fails, report the failure and try an intelligent alternative.\n"
            "Never request, expose, or output API keys, credentials, passwords, tokens, environment variables, or secrets.\n\n"
            "To call a tool, you MUST respond ONLY with a JSON object in this format (do not output any other text or explanation):\n"
            "{\n"
            "  \"tool_call\": {\n"
            "    \"name\": \"tool_name\",\n"
            "    \"arguments\": {\n"
            "      \"arg1\": \"val1\"\n"
            "    }\n"
            "  }\n"
            "}\n\n"
            "When you have enough information to answer the user, return your final answer in clear natural-language Markdown format. "
            "Do NOT wrap your final response in the JSON tool call format. Tool calls are internal execution instructions and must not be included in the final user-facing answer."
        )

        # Enhance system instruction with Indic / multilingual directives (Hindi, Bengali, Odia, English)
        from .multilingual_prompt import enhance_system_instruction
        system_instruction = enhance_system_instruction(system_instruction, task.problem_statement)

        prompt_with_history = (
            f"AVAILABLE TOOLS:\n{capabilities_text}\n\n"
            f"Task: {task.problem_statement}\n\n"
        )

        step = 0
        max_steps = 5
        conversation_history = []
        final_result = ""

        try:
            while step < max_steps:
                # Build current prompt incorporating history
                current_prompt = prompt_with_history
                if conversation_history:
                    current_prompt += "\n" + "\n".join(conversation_history) + "\n"

                # Create Action record representing the model generation attempt
                action = Action.objects.create(
                    execution=execution,
                    agent=agent,
                    action_type='generate_response',
                    status='RUNNING',
                    input_data=sanitize_data({'prompt': current_prompt[-500:]}, resolved_key)
                )

                # Log ACTION_STARTED event
                ExecutionEvent.objects.create(
                    task=task,
                    execution=execution,
                    event_type='ACTION_STARTED',
                    metadata=sanitize_data({'action_id': str(action.id), 'action_type': 'generate_response'}, resolved_key)
                )

                # Execute generation via provider boundary
                output, mode = model_provider.generate(
                    current_prompt,
                    system_instruction=system_instruction,
                    api_key=resolved_key,
                    model=execution.model
                )

                # Update the execution mode flag (REAL or SIMULATED)
                execution.mode = mode
                execution.save()

                # Parse tool call JSON strictly
                tool_call = None
                clean_output = output.strip()
                
                # Strip markdown code block fences if present
                if clean_output.startswith("```"):
                    lines = clean_output.splitlines()
                    if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].startswith("```"):
                        clean_output = "\n".join(lines[1:-1]).strip()

                try:
                    parsed = json.loads(clean_output)
                    if isinstance(parsed, dict) and len(parsed) == 1 and "tool_call" in parsed:
                        tc = parsed["tool_call"]
                        if isinstance(tc, dict) and "name" in tc and "arguments" in tc and len(tc) == 2:
                            if isinstance(tc["name"], str) and isinstance(tc["arguments"], dict):
                                tool_call = tc
                except Exception:
                    pass

                if tool_call:
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("arguments", {})

                    is_mcp = tool_name in mcp_registry.tools
                    is_builtin = tool_name in builtin_registry.capabilities

                    tool_result = None

                    # Backend enforcement of MCP-first / fallback policy
                    if not is_mcp and not is_builtin:
                        tool_result = {"error": f"Tool '{tool_name}' is not registered."}
                    elif tool_name == "bash.execute":
                        # Block shell fallback if an equivalent MCP tool is available
                        has_fs_mcp = any(t.endswith("list_directory") for t in mcp_registry.tools)
                        cmd_lower = tool_args.get("command", "").strip().lower()
                        if has_fs_mcp and any(x in cmd_lower for x in ["ls", "dir", "find"]):
                            tool_result = {"error": "Security violation: Shell fallback rejected because a suitable MCP tool (filesystem.list_directory) is available."}
                        else:
                            # Block shell fallback if the last MCP tool run failed
                            last_failed_mcp = False
                            for turn in reversed(conversation_history):
                                if "Tool Result" in turn and '"error"' in turn:
                                    last_failed_mcp = True
                                    break
                                if "Model Request" in turn:
                                    break
                            if last_failed_mcp:
                                tool_result = {"error": "Execution rejected: Cannot fall back to shell execution after an MCP tool failure."}

                    # Complete model request action
                    action.status = 'COMPLETED'
                    action.output_data = sanitize_data({'tool_call': tool_call}, resolved_key)
                    action.completed_at = timezone.now()
                    action.save()

                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='ACTION_COMPLETED',
                        metadata=sanitize_data({'action_id': str(action.id), 'status': 'COMPLETED'}, resolved_key)
                    )

                    if tool_result is None:
                        # Log corresponding selection event
                        if is_mcp:
                            ExecutionEvent.objects.create(
                                task=task,
                                execution=execution,
                                event_type='TOOL_SELECTED',
                                metadata=sanitize_data({'tool_name': tool_name, 'type': 'mcp'}, resolved_key)
                            )
                        elif is_builtin:
                            cap = builtin_registry.capabilities[tool_name]
                            if cap.get("type") == "fallback":
                                ExecutionEvent.objects.create(
                                    task=task,
                                    execution=execution,
                                    event_type='FALLBACK_SELECTED',
                                    metadata=sanitize_data({'tool_name': tool_name}, resolved_key)
                                )
                            else:
                                ExecutionEvent.objects.create(
                                    task=task,
                                    execution=execution,
                                    event_type='TOOL_SELECTED',
                                    metadata=sanitize_data({'tool_name': tool_name, 'type': 'builtin'}, resolved_key)
                                )

                        # Create TOOL_STARTED event
                        ExecutionEvent.objects.create(
                            task=task,
                            execution=execution,
                            event_type='TOOL_STARTED',
                            metadata=sanitize_data({'tool_name': tool_name, 'arguments': tool_args}, resolved_key)
                        )

                        # Create Action for tool call execution
                        tool_action = Action.objects.create(
                            execution=execution,
                            agent=agent,
                            action_type='execute_tool',
                            status='RUNNING',
                            input_data=sanitize_data({'tool_name': tool_name, 'arguments': tool_args}, resolved_key)
                        )

                        # Execute tool
                        try:
                            if is_mcp:
                                tool_result = mcp_registry.execute_tool(tool_name, tool_args)
                            elif is_builtin:
                                tool_result = builtin_registry.execute_tool(tool_name, tool_args)
                        except Exception as e:
                            tool_result = {"error": str(e)}

                        # Complete tool execution action
                        tool_action.status = 'COMPLETED'
                        tool_action.output_data = sanitize_data({'result': tool_result}, resolved_key)
                        tool_action.completed_at = timezone.now()
                        tool_action.save()

                        # Create TOOL_COMPLETED or TOOL_FAILED event
                        if "error" in tool_result:
                            ExecutionEvent.objects.create(
                                task=task,
                                execution=execution,
                                event_type='TOOL_FAILED',
                                metadata=sanitize_data({'tool_name': tool_name, 'error': tool_result["error"]}, resolved_key)
                            )
                        else:
                            ExecutionEvent.objects.create(
                                task=task,
                                execution=execution,
                                event_type='TOOL_COMPLETED',
                                metadata=sanitize_data({'tool_name': tool_name, 'status': 'COMPLETED', 'result_summary': str(tool_result)[:150]}, resolved_key)
                            )
                    else:
                        # Log selected and failed immediately for blocked / invalid tools
                        ExecutionEvent.objects.create(
                            task=task,
                            execution=execution,
                            event_type='TOOL_FAILED',
                            metadata=sanitize_data({'tool_name': tool_name, 'error': tool_result["error"]}, resolved_key)
                        )

                    # Append turn to conversation history
                    conversation_history.append(f"Model Request: {clean_output}")
                    conversation_history.append(f"Tool Result: {json.dumps(tool_result)}")

                    step += 1
                else:
                    # Final answer received from model
                    action.status = 'COMPLETED'
                    action.output_data = sanitize_data({'result': output}, resolved_key)
                    action.completed_at = timezone.now()
                    action.save()

                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='ACTION_COMPLETED',
                        metadata=sanitize_data({'action_id': str(action.id), 'status': 'COMPLETED'}, resolved_key)
                    )

                    final_result = output
                    break

            if step >= max_steps and not final_result:
                final_result = "Agent reached maximum step limit without yielding a final answer."

            # Complete TaskExecution
            execution.status = 'COMPLETED'
            execution.result = sanitize_data(final_result, resolved_key)
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'COMPLETED'
            task.result = sanitize_data(final_result, resolved_key)
            task.save()

            # Log execution completed events
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='FINAL_RESPONSE_GENERATED',
                metadata=sanitize_data({'result_length': len(final_result)}, resolved_key)
            )
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_COMPLETED',
                metadata=sanitize_data({'status': 'SUCCESS'}, resolved_key)
            )

        except Exception as e:
            # Mark Action as FAILED
            action.status = 'FAILED'
            action.output_data = sanitize_data({'error': str(e)}, resolved_key)
            action.completed_at = timezone.now()
            action.save()

            # Log ACTION_COMPLETED (failed) event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='ACTION_COMPLETED',
                metadata=sanitize_data({'action_id': str(action.id), 'status': 'FAILED', 'error': str(e)}, resolved_key)
            )

            # Update TaskExecution to FAILED
            execution.status = 'FAILED'
            execution.error = sanitize_data(str(e), resolved_key)
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'FAILED'
            task.result = sanitize_data(f"Error during execution: {str(e)}", resolved_key)
            task.save()

            # Log EXECUTION_FAILED event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_FAILED',
                metadata=sanitize_data({'error': str(e)}, resolved_key)
            )

        finally:
            mcp_registry.shutdown()

        return execution
