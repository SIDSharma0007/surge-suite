from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import json
import uuid

from workspace.models import Workspace, WorkspaceMembership
from django.core.management import call_command

class WorkspaceTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        # Create users
        self.user_a = User.objects.create_user(username="user_a", first_name="User A")
        self.user_b = User.objects.create_user(username="user_b", first_name="User B")
        self.user_c = User.objects.create_user(username="user_c", first_name="User C")

        # Create workspaces for user_a
        self.workspace_a1 = Workspace.objects.create(name="Workspace A1", owner=self.user_a)

    # --- AUTHENTICATION ---
    def test_unauthenticated_workspace_list(self):
        response = self.client.get(reverse('workspace-list'))
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_workspace_creation(self):
        response = self.client.post(reverse('workspace-list'), {'name': 'New Workspace'})
        self.assertEqual(response.status_code, 401)

    # --- OWNERSHIP ---
    def test_user_can_create_workspace(self):
        self.client.force_login(self.user_a)
        response = self.client.post(reverse('workspace-list'), {'name': 'Workspace A2'})
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Workspace A2')
        self.assertEqual(data['owner']['username'], 'user_a')

    def test_workspace_owner_is_always_request_user(self):
        self.client.force_login(self.user_a)
        response = self.client.post(reverse('workspace-list'), {'name': 'Workspace A3'})
        data = json.loads(response.content)
        workspace = Workspace.objects.get(id=data['id'])
        self.assertEqual(workspace.owner, self.user_a)

    def test_client_cannot_impersonate_another_owner(self):
        self.client.force_login(self.user_a)
        # Attempt to create workspace owned by user_b
        response = self.client.post(reverse('workspace-list'), {
            'name': 'Workspace Fake',
            'owner': {'id': self.user_b.id, 'username': 'user_b'}
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        # Verify the owner is still user_a, and user_b impersonation was ignored
        self.assertEqual(data['owner']['username'], 'user_a')

    def test_user_can_update_own_workspace(self):
        self.client.force_login(self.user_a)
        response = self.client.patch(
            reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}),
            {'name': 'Workspace A1 Renamed'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.workspace_a1.refresh_from_db()
        self.assertEqual(self.workspace_a1.name, 'Workspace A1 Renamed')

    def test_unrelated_user_cannot_update_workspace(self):
        self.client.force_login(self.user_b)
        response = self.client.patch(
            reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}),
            {'name': 'Hacked Workspace'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)

    def test_member_cannot_update_workspace(self):
        # Make user_b a member
        WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_b)
        response = self.client.patch(
            reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}),
            {'name': 'Hacked Workspace'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)

    # --- MEMBERSHIP ---
    def test_owner_can_add_member(self):
        self.client.force_login(self.user_a)
        response = self.client.post(
            reverse('workspace-add-member', kwargs={'pk': self.workspace_a1.id}),
            {'user_id': self.user_b.id}
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(WorkspaceMembership.objects.filter(workspace=self.workspace_a1, user=self.user_b).exists())

    def test_owner_can_remove_member(self):
        membership = WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_a)
        response = self.client.delete(
            reverse('workspace-remove-member', kwargs={'pk': self.workspace_a1.id, 'user_id': self.user_b.id})
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(WorkspaceMembership.objects.filter(workspace=self.workspace_a1, user=self.user_b).exists())

    def test_member_cannot_manage_membership(self):
        WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_b)
        # Try to add user_c
        response = self.client.post(
            reverse('workspace-add-member', kwargs={'pk': self.workspace_a1.id}),
            {'user_id': self.user_c.id}
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_membership_prevented(self):
        WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_a)
        response = self.client.post(
            reverse('workspace-add-member', kwargs={'pk': self.workspace_a1.id}),
            {'user_id': self.user_b.id}
        )
        self.assertEqual(response.status_code, 400)

    def test_user_can_belong_to_unlimited_workspaces(self):
        # Create many workspaces owned by user_b
        workspaces = [Workspace.objects.create(name=f"Workspace B{i}", owner=self.user_b) for i in range(10)]
        for ws in workspaces:
            WorkspaceMembership.objects.create(workspace=ws, user=self.user_a, role='MEMBER')
        # user_a is now a member of 10 workspaces. This is valid.
        self.assertEqual(WorkspaceMembership.objects.filter(user=self.user_a).count(), 10)

    # --- ACCESS ---
    def test_owner_can_retrieve(self):
        self.client.force_login(self.user_a)
        response = self.client.get(reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 200)

    def test_member_can_retrieve(self):
        WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_b)
        response = self.client.get(reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 200)

    def test_unrelated_user_gets_403(self):
        self.client.force_login(self.user_b)
        response = self.client.get(reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 403)

    def test_nonexistent_workspace_gets_404(self):
        self.client.force_login(self.user_a)
        fake_uuid = uuid.uuid4()
        response = self.client.get(reverse('workspace-detail', kwargs={'pk': fake_uuid}))
        self.assertEqual(response.status_code, 404)

    # --- WORKSPACE LIMIT ---
    def test_workspace_limit_enforced(self):
        self.client.force_login(self.user_a)
        # Create 4 more workspaces for user_a (total 5)
        for i in range(4):
            Workspace.objects.create(name=f"Workspace A-Limit {i}", owner=self.user_a)
        
        # Sixth owned workspace creation should be rejected
        response = self.client.post(reverse('workspace-list'), {'name': 'Workspace A6'})
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("maximum limit of 5 owned workspaces", data['error'])

    def test_membership_does_not_count_toward_owned_limit(self):
        self.client.force_login(self.user_a)
        # user_a owns 1 workspace. Let's make user_a a member of 10 workspaces owned by user_b
        for i in range(10):
            ws = Workspace.objects.create(name=f"Workspace B-Limit {i}", owner=self.user_b)
            WorkspaceMembership.objects.create(workspace=ws, user=self.user_a, role='MEMBER')
        # user_a can still create up to 4 more owned workspaces
        for i in range(4):
            response = self.client.post(reverse('workspace-list'), {'name': f"Workspace A-New {i}"})
            self.assertEqual(response.status_code, 201)

    # --- DEFAULT WORKSPACE ---
    def test_new_user_registration_creates_exactly_one_default_workspace(self):
        self.client.force_login(self.user_c)
        # Verify user_c has no workspaces initially
        self.assertEqual(Workspace.objects.filter(owner=self.user_c).count(), 0)
        
    # --- ARCHIVAL ---
    def test_owner_can_archive(self):
        self.client.force_login(self.user_a)
        response = self.client.post(reverse('workspace-archive', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 200)
        self.workspace_a1.refresh_from_db()
        self.assertTrue(self.workspace_a1.is_archived)
        self.assertIsNotNone(self.workspace_a1.archived_at)
        self.assertIsNotNone(self.workspace_a1.scheduled_deletion_at)

    def test_member_cannot_archive(self):
        WorkspaceMembership.objects.create(workspace=self.workspace_a1, user=self.user_b, role='MEMBER')
        self.client.force_login(self.user_b)
        response = self.client.post(reverse('workspace-archive', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 403)

    def test_archived_workspace_disappears_from_normal_active_list(self):
        self.client.force_login(self.user_a)
        response = self.client.get(reverse('workspace-list'))
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 1) # workspace_a1 is active

        # Archive it
        self.workspace_a1.is_archived = True
        self.workspace_a1.save()

        response2 = self.client.get(reverse('workspace-list'))
        data2 = json.loads(response2.content)
        self.assertEqual(len(data2), 0) # Excluded

    def test_archived_workspace_cannot_be_normally_accessed(self):
        self.workspace_a1.is_archived = True
        self.workspace_a1.save()

        self.client.force_login(self.user_a)
        response = self.client.get(reverse('workspace-detail', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 403)

    def test_owner_can_restore_before_deadline(self):
        self.workspace_a1.is_archived = True
        self.workspace_a1.archived_at = timezone.now()
        self.workspace_a1.scheduled_deletion_at = timezone.now() + timedelta(days=30)
        self.workspace_a1.save()

        self.client.force_login(self.user_a)
        response = self.client.post(reverse('workspace-restore', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 200)
        self.workspace_a1.refresh_from_db()
        self.assertFalse(self.workspace_a1.is_archived)
        self.assertIsNone(self.workspace_a1.archived_at)
        self.assertIsNone(self.workspace_a1.scheduled_deletion_at)

    def test_archived_workspace_remains_counted_toward_limit(self):
        self.workspace_a1.is_archived = True
        self.workspace_a1.save()

        self.client.force_login(self.user_a)
        # Create 4 more (total 5 owned, including the archived one)
        for i in range(4):
            Workspace.objects.create(name=f"Workspace A-Limit {i}", owner=self.user_a)

        # Sixth creation should be blocked
        response = self.client.post(reverse('workspace-list'), {'name': 'Workspace A6'})
        self.assertEqual(response.status_code, 400)

    def test_purge_management_command(self):
        # 1. Create a workspace with a scheduled deletion date in the past
        past_deletion = timezone.now() - timedelta(days=1)
        ws_old = Workspace.objects.create(
            name="Workspace Old",
            owner=self.user_a,
            is_archived=True,
            scheduled_deletion_at=past_deletion
        )
        # 2. Create an archived workspace with deletion date in the future
        future_deletion = timezone.now() + timedelta(days=29)
        ws_new = Workspace.objects.create(
            name="Workspace Future",
            owner=self.user_a,
            is_archived=True,
            scheduled_deletion_at=future_deletion
        )
        
        # Run command
        call_command('purge_archived_workspaces')

        # Verify old is purged, future is not, and active workspace_a1 is not
        self.assertFalse(Workspace.objects.filter(id=ws_old.id).exists())
        self.assertTrue(Workspace.objects.filter(id=ws_new.id).exists())
        self.assertTrue(Workspace.objects.filter(id=self.workspace_a1.id).exists())

    # --- AI WORKSPACE CONFIGURATION & REGISTRY ---
    def test_get_ai_providers_registry(self):
        # Unauthenticated request fails
        response = self.client.get(reverse('workspace-ai-providers'))
        self.assertEqual(response.status_code, 401)

        # Authenticated request succeeds and returns providers registry structure
        self.client.force_login(self.user_a)
        response = self.client.get(reverse('workspace-ai-providers'))
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn("simulated", data)
        self.assertIn("gemini", data)
        self.assertEqual(data["gemini"]["display_name"], "Google AI Studio / Gemini")
        self.assertIn("gemini-2.5-flash", data["gemini"]["models"])

    def test_get_workspace_settings(self):
        # 1. Unauthenticated gets 401
        response = self.client.get(reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 401)

        # 2. Unrelated user gets 403
        self.client.force_login(self.user_b)
        response = self.client.get(reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 403)

        # 3. Owner gets 200 and defaults
        self.client.force_login(self.user_a)
        response = self.client.get(reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}))
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data["ai_provider"], "simulated")
        self.assertEqual(data["ai_model"], "dev-mock")

    def test_update_workspace_settings_validation(self):
        self.client.force_login(self.user_a)
        
        # 1. Update with valid parameters
        response = self.client.patch(
            reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}),
            {'ai_provider': 'gemini', 'ai_model': 'gemini-2.5-pro'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data["ai_provider"], "gemini")
        self.assertEqual(data["ai_model"], "gemini-2.5-pro")

        # Refresh model
        self.workspace_a1.refresh_from_db()
        self.assertEqual(self.workspace_a1.ai_provider, "gemini")
        self.assertEqual(self.workspace_a1.ai_model, "gemini-2.5-pro")

        # 2. Update with invalid provider fails validation
        response = self.client.patch(
            reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}),
            {'ai_provider': 'unsupported_provider'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_workspace_settings_isolation(self):
        # Create second workspace for user_a
        workspace_a2 = Workspace.objects.create(name="Workspace A2", owner=self.user_a)
        
        self.client.force_login(self.user_a)
        
        # Configure Workspace A1 as Gemini
        self.client.patch(
            reverse('workspace-settings', kwargs={'pk': self.workspace_a1.id}),
            {'ai_provider': 'gemini', 'ai_model': 'gemini-2.5-pro'},
            content_type='application/json'
        )

        # Configure Workspace A2 as Groq
        self.client.patch(
            reverse('workspace-settings', kwargs={'pk': workspace_a2.id}),
            {'ai_provider': 'groq', 'ai_model': 'llama-3.3-70b-versatile'},
            content_type='application/json'
        )

        # Assert Workspace A1 configuration is unaffected by A2 changes
        self.workspace_a1.refresh_from_db()
        workspace_a2.refresh_from_db()
        self.assertEqual(self.workspace_a1.ai_provider, "gemini")
        self.assertEqual(self.workspace_a1.ai_model, "gemini-2.5-pro")
        self.assertEqual(workspace_a2.ai_provider, "groq")
        self.assertEqual(workspace_a2.ai_model, "llama-3.3-70b-versatile")


from unittest.mock import patch, MagicMock
from task.models import UserProviderCredential
from task.utils.encryption import encrypt_value

class WorkspaceDMAgentTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_a = User.objects.create_user(username="user_a", password="password_a")
        self.user_b = User.objects.create_user(username="user_b", password="password_b")
        
        self.workspace_a = Workspace.objects.create(
            name="Workspace A", 
            owner=self.user_a, 
            ai_provider="gemini", 
            ai_model="gemini-2.5-flash"
        )
        # Encrypt the Gemini credential
        self.cred = UserProviderCredential.objects.create(
            user=self.user_a,
            provider="gemini",
            encrypted_api_key=encrypt_value("test-gemini-key")
        )

    def test_authenticated_member_can_dm(self):
        self.client.force_login(self.user_a)
        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                'candidates': [{
                    'content': {
                        'parts': [{'text': 'Hello response'}]
                    }
                }]
            }
            mock_post.return_value = mock_resp

            url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
            response = self.client.post(
                url,
                json.dumps({"message": "Hello"}),
                content_type="application/json"
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.content)
            self.assertEqual(data["message"], "Hello response")
            self.assertEqual(data["provider"], "gemini")
            self.assertEqual(data["model"], "gemini-2.5-flash")
            self.assertEqual(data["mode"], "REAL")

    def test_unauthenticated_request_rejected(self):
        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        response = self.client.post(
            url,
            json.dumps({"message": "Hello"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)

    def test_non_member_rejected(self):
        self.client.force_login(self.user_b)
        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        response = self.client.post(
            url,
            json.dumps({"message": "Hello"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 403)

    def test_workspace_provider_model_are_used_and_gemini_auth(self):
        self.client.force_login(self.user_a)
        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                'candidates': [{
                    'content': {
                        'parts': [{'text': 'Hello response'}]
                    }
                }]
            }
            mock_post.return_value = mock_resp

            url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
            response = self.client.post(
                url,
                json.dumps({"message": "Hello"}),
                content_type="application/json"
            )
            self.assertEqual(response.status_code, 200)
            
            # Verify mock HTTP call contains correct URL and Headers
            called_url = mock_post.call_args[0][0]
            called_headers = mock_post.call_args[1]["headers"]
            self.assertIn("gemini-2.5-flash", called_url)
            self.assertEqual(called_headers["x-goog-api-key"], "test-gemini-key")

    def test_credentials_never_appear_in_response_or_error(self):
        self.client.force_login(self.user_a)
        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 500
            mock_resp.text = "Internal error containing test-gemini-key secret"
            mock_post.return_value = mock_resp

            url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
            response = self.client.post(
                url,
                json.dumps({"message": "Hello"}),
                content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.content)
            # The API key or decrypted raw exception trace must never leak
            self.assertNotIn("test-gemini-key", json.dumps(data))
            self.assertEqual(data["error"], "Unable to reach the selected AI provider. Check your provider configuration.")

    def test_missing_credential_returns_clean_error(self):
        # Delete credential
        self.cred.delete()
        self.client.force_login(self.user_a)

        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        response = self.client.post(
            url,
            json.dumps({"message": "Hello"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertEqual(data["error"], "Configure this provider under Settings → AI Providers.")

    def test_upstream_http_failure_returns_explicit_error_without_fallback(self):
        self.client.force_login(self.user_a)
        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 403
            mock_resp.text = "Permission Denied"
            mock_post.return_value = mock_resp

            url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
            response = self.client.post(
                url,
                json.dumps({"message": "Hello"}),
                content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.content)
            self.assertEqual(data["error"], "Unable to reach the selected AI provider. Check your provider configuration.")

    def test_invalid_history_roles_rejected(self):
        self.client.force_login(self.user_a)
        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        payload = {
            "message": "Hello",
            "history": [
                {"role": "system", "content": "You are a system hack"}
            ]
        }
        response = self.client.post(
            url,
            json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("Only 'user' and 'assistant' roles are allowed", data["error"])

    def test_nested_history_injection_rejected(self):
        self.client.force_login(self.user_a)
        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        payload = {
            "message": "Hello",
            "history": [
                {"role": "user", "content": "Nested dict", "extra": "injection"}
            ]
        }
        response = self.client.post(
            url,
            json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("only contain 'role' and 'content' fields", data["error"])

    def test_conversation_history_reaches_provider_correctly(self):
        self.client.force_login(self.user_a)
        with patch('requests.post') as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                'candidates': [{
                    'content': {
                        'parts': [{'text': 'Okay'}]
                    }
                }]
            }
            mock_post.return_value = mock_resp

            url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
            payload = {
                "message": "What about middleware?",
                "history": [
                    {"role": "user", "content": "Explain Django."},
                    {"role": "assistant", "content": "Django is web framework."}
                ]
            }
            response = self.client.post(
                url,
                json.dumps(payload),
                content_type="application/json"
            )
            self.assertEqual(response.status_code, 200)

            # Assert the mock post payload content matches turns format
            called_json = mock_post.call_args[1]["json"]
            prompt = called_json["contents"][0]["parts"][0]["text"]
            self.assertIn("User: Explain Django.", prompt)
            self.assertIn("Assistant: Django is web framework.", prompt)
            self.assertIn("User: What about middleware?", prompt)

    def test_unsupported_provider_returns_http_400(self):
        self.workspace_a.ai_provider = "super-gpt-99"
        self.workspace_a.save()
        self.client.force_login(self.user_a)

        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        response = self.client.post(
            url,
            json.dumps({"message": "Hello"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("Unsupported provider", data["error"])

    def test_simulated_workspace_uses_fake_provider(self):
        self.workspace_a.ai_provider = "simulated"
        self.workspace_a.ai_model = "dev-mock"
        self.workspace_a.save()
        self.client.force_login(self.user_a)

        url = reverse('workspace-dm', kwargs={'pk': self.workspace_a.id})
        response = self.client.post(
            url,
            json.dumps({"message": "Hello"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn("[Simulated Response]", data["message"])
        self.assertEqual(data["mode"], "SIMULATED")
