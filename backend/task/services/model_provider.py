import requests
from decouple import config

class ModelProvider:
    """
    Interface boundary for runtime LLM execution.
    """
    def generate(self, prompt: str, system_instruction: str = None) -> tuple[str, str]:
        """
        Returns a tuple of (result_text, mode_string) where mode_string is 'REAL' or 'SIMULATED'.
        """
        raise NotImplementedError("Subclasses must implement generate()")

class RealGeminiModelProvider(ModelProvider):
    def __init__(self):
        self.api_key = config("GEMINI_API_KEY", default="")

    def generate(self, prompt: str, system_instruction: str = None) -> tuple[str, str]:
        if not self.api_key:
            # Fall back to simulated execution if credentials are not configured,
            # but mark it explicitly as SIMULATED so we never silently spoof.
            return f"[Simulated Response] Fallback. Prompt: {prompt}", "SIMULATED"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        headers = {
            "Content-Type": "application/json"
        }
        contents = [{
            "parts": [{"text": prompt}]
        }]
        data = {
            "contents": contents
        }
        if system_instruction:
            data["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            if response.status_code == 200:
                res_data = response.json()
                text = res_data['candidates'][0]['content']['parts'][0]['text']
                return text, "REAL"
            else:
                return f"Error: API returned status code {response.status_code}. Detail: {response.text}", "REAL"
        except Exception as e:
            return f"Error: Failed to connect to model provider. Detail: {str(e)}", "REAL"

class FakeModelProvider(ModelProvider):
    def generate(self, prompt: str, system_instruction: str = None) -> tuple[str, str]:
        # Deterministic simulation for tests and offline development
        return f"[Simulated Response] Mode: SIMULATED. Prompt: {prompt}", "SIMULATED"
