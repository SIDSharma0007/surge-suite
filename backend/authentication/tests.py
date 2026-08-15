from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
import json

class SessionLifecycleTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        # Create a test canonical user
        self.username = "test_user_uuid_12345"
        self.display_name = "Test User"
        self.user = User.objects.create_user(
            username=self.username,
            first_name=self.display_name
        )
        
    def test_unauthenticated_me_endpoint(self):
        """
        1. An unauthenticated request to /me/ should return 401 Unauthorized.
        """
        response = self.client.get(reverse('me-api'))
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.content)
        self.assertFalse(data['authenticated'])
        self.assertEqual(data['error'], "Not authenticated")
        
    def test_authenticated_me_endpoint(self):
        """
        2. Once authenticated, /me/ should return 200 and resolved user details.
        """
        # Log in the client using the test user
        self.client.force_login(self.user)
        
        response = self.client.get(reverse('me-api'))
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['authenticated'])
        self.assertEqual(data['user']['user_id'], self.username)
        self.assertEqual(data['user']['name'], self.display_name)
        
    def test_logout_session_invalidation(self):
        """
        3. Calling logout should invalidate the session, making subsequent /me/ requests 401.
        """
        self.client.force_login(self.user)
        
        # Verify authenticated first
        response = self.client.get(reverse('me-api'))
        self.assertEqual(response.status_code, 200)
        
        # Call logout
        logout_response = self.client.post(reverse('logout-api'))
        self.assertEqual(logout_response.status_code, 200)
        logout_data = json.loads(logout_response.content)
        self.assertTrue(logout_data['success'])
        
        # Verify subsequent me request is rejected
        subsequent_response = self.client.get(reverse('me-api'))
        self.assertEqual(subsequent_response.status_code, 401)
