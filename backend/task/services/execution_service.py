from django.utils import timezone
from task.models import Task, TaskExecution, Action, ExecutionEvent
from .model_provider import RealGeminiModelProvider, FakeModelProvider

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
            model_provider, is_real = get_model_provider_by_name(provider_name)
            
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
                        metadata={'error': f"Configure this provider under Settings → AI Providers."}
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

        from .capability_registry import CapabilityRegistry
        registry = CapabilityRegistry()
        capabilities = registry.discover_capabilities()
        
        # Build capabilities prompt text
        capabilities_text = "\n".join([
            f"- {cap['name']}: {cap['description']}. Arguments Schema: {cap['schema']}"
            for cap in capabilities
        ])
        
        system_instruction = (
            "You are the Surge Suite task agent. Complete the user's task using the capabilities available to you.\n"
            "Use a specialized MCP or builtin capability when it is useful.\n"
            "Use bash.execute only when no suitable specialized capability exists or bash is genuinely the appropriate fallback.\n"
            "Never invent tools.\n"
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

        prompt_with_history = (
            f"AVAILABLE TOOLS:\n{capabilities_text}\n\n"
            f"Task: {task.problem_statement}\n\n"
        )

        # Log EXECUTION_STARTED event
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='EXECUTION_STARTED',
            metadata={'agent_id': str(agent.id), 'mode': execution.mode}
        )
        
        # Log TOOL_DISCOVERED event at startup
        ExecutionEvent.objects.create(
            task=task,
            execution=execution,
            event_type='TOOL_DISCOVERED',
            metadata={'capabilities': [c['name'] for c in capabilities]}
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
                    input_data={'prompt': current_prompt[-500:]}
                )

                # Log ACTION_STARTED event
                ExecutionEvent.objects.create(
                    task=task,
                    execution=execution,
                    event_type='ACTION_STARTED',
                    metadata={'action_id': str(action.id), 'action_type': 'generate_response'}
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

                # Parse tool call JSON if requested
                import json
                tool_call = None
                clean_output = output.strip()
                
                if "{" in clean_output and "}" in clean_output:
                    try:
                        import re
                        json_match = re.search(r'\{.*\}', clean_output, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            if "tool_call" in parsed:
                                tool_call = parsed["tool_call"]
                    except Exception:
                        pass

                if tool_call:
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("arguments", {})

                    # Complete model request action
                    action.status = 'COMPLETED'
                    action.output_data = {'tool_call': tool_call}
                    action.completed_at = timezone.now()
                    action.save()

                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='ACTION_COMPLETED',
                        metadata={'action_id': str(action.id), 'status': 'COMPLETED'}
                    )

                    # Create TOOL_STARTED event
                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='TOOL_STARTED',
                        metadata={'tool_name': tool_name, 'arguments': tool_args}
                    )

                    # Create Action for tool call execution
                    tool_action = Action.objects.create(
                        execution=execution,
                        agent=agent,
                        action_type='execute_tool',
                        status='RUNNING',
                        input_data={'tool_name': tool_name, 'arguments': tool_args}
                    )

                    # Execute tool
                    tool_result = registry.execute_tool(tool_name, tool_args)

                    # Sanitize tool results (remove any passwords, secrets)
                    tool_result_str = str(tool_result)
                    if resolved_key and resolved_key in tool_result_str:
                        tool_result_str = tool_result_str.replace(resolved_key, "••••••••")
                        tool_result = {"error": "Security violation: Key exposure prevented.", "data": tool_result_str}

                    # Complete tool execution action
                    tool_action.status = 'COMPLETED'
                    tool_action.output_data = {'result': tool_result}
                    tool_action.completed_at = timezone.now()
                    tool_action.save()

                    # Create TOOL_COMPLETED event
                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='TOOL_COMPLETED',
                        metadata={'tool_name': tool_name, 'status': 'COMPLETED', 'result_summary': str(tool_result)[:150]}
                    )

                    # Append turn to conversation history
                    conversation_history.append(f"Model Request: {clean_output}")
                    conversation_history.append(f"Tool Result: {json.dumps(tool_result)}")

                    step += 1
                else:
                    # Final answer received from model
                    action.status = 'COMPLETED'
                    action.output_data = {'result': output}
                    action.completed_at = timezone.now()
                    action.save()

                    ExecutionEvent.objects.create(
                        task=task,
                        execution=execution,
                        event_type='ACTION_COMPLETED',
                        metadata={'action_id': str(action.id), 'status': 'COMPLETED'}
                    )

                    final_result = output
                    break

            if step >= max_steps and not final_result:
                final_result = "Agent reached maximum step limit without yielding a final answer."

            # Complete TaskExecution
            execution.status = 'COMPLETED'
            execution.result = final_result
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'COMPLETED'
            task.result = final_result
            task.save()

            # Log execution completed events
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='FINAL_RESPONSE_GENERATED',
                metadata={'result_length': len(final_result)}
            )
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_COMPLETED',
                metadata={'status': 'SUCCESS'}
            )

        except Exception as e:
            # Mark Action as FAILED
            action.status = 'FAILED'
            action.output_data = {'error': str(e)}
            action.completed_at = timezone.now()
            action.save()

            # Log ACTION_COMPLETED (failed) event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='ACTION_COMPLETED',
                metadata={'action_id': str(action.id), 'status': 'FAILED', 'error': str(e)}
            )

            # Update TaskExecution to FAILED
            execution.status = 'FAILED'
            execution.error = str(e)
            execution.completed_at = timezone.now()
            execution.save()

            # Update base Task state
            task.status = 'FAILED'
            task.result = f"Error during execution: {str(e)}"
            task.save()

            # Log EXECUTION_FAILED event
            ExecutionEvent.objects.create(
                task=task,
                execution=execution,
                event_type='EXECUTION_FAILED',
                metadata={'error': str(e)}
            )

        return execution
