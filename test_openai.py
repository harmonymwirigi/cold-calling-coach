import os
from dotenv import load_dotenv
import openai
import json
from datetime import datetime

# Load environment variables
load_dotenv()

def test_openai_credentials():
    """Test if OpenAI API key is valid"""
    print("\nTesting OpenAI credentials...")
    
    api_key = os.getenv('REACT_APP_OPENAI_API_KEY')
    if not api_key:
        print("❌ OpenAI API key not found in environment variables")
        return False
        
    # Check API key format
    if not api_key.startswith('sk-'):
        print("❌ OpenAI API key appears invalid (should start with 'sk-')")
        return False
        
    print(f"✅ OpenAI API key found: {api_key[:4]}...{api_key[-4:]}")
    
    try:
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=api_key)
        
        # Make a simple test request
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'OpenAI test successful' if you can read this."}
            ],
            max_tokens=10
        )
        
        # Check response
        if response.choices and response.choices[0].message.content:
            print("✅ OpenAI API test successful!")
            print(f"   Response: {response.choices[0].message.content}")
            return True
            
    except Exception as e:
        print(f"❌ OpenAI API test failed:")
        print(f"   Error: {str(e)}")
        
        if "Incorrect API key" in str(e):
            print("\nTroubleshooting tips:")
            print("1. Your OpenAI API key is invalid")
            print("2. Generate a new API key in the OpenAI Console")
            print("3. Make sure you're using the correct API key")
        elif "Rate limit" in str(e):
            print("\nTroubleshooting tips:")
            print("1. You've hit the OpenAI rate limit")
            print("2. Wait a few minutes and try again")
            print("3. Check your usage in the OpenAI Console")
        return False

def test_openai_cold_call():
    """Test OpenAI with a cold call scenario"""
    print("\nTesting OpenAI cold call response...")
    
    try:
        client = openai.OpenAI(api_key=os.getenv('REACT_APP_OPENAI_API_KEY'))
        
        # Test a cold call opener
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a sales prospect in a cold call. Respond naturally to the caller."},
                {"role": "user", "content": "Hi Sarah, I know this is out of the blue, but I'm calling from TechCorp. Can I tell you why I'm calling?"}
            ],
            max_tokens=50
        )
        
        if response.choices and response.choices[0].message.content:
            print("✅ Cold call test successful!")
            print(f"   Prospect response: {response.choices[0].message.content}")
            return True
            
    except Exception as e:
        print(f"❌ Cold call test failed: {str(e)}")
        return False

def main():
    print("Starting OpenAI Integration Tests...")
    
    # Test credentials
    credentials_ok = test_openai_credentials()
    
    # Test cold call if credentials are valid
    cold_call_ok = False
    if credentials_ok:
        cold_call_ok = test_openai_cold_call()
    
    # Print summary
    print("\n=== Test Summary ===")
    print(f"OpenAI Credentials: {'✅ Success' if credentials_ok else '❌ Failed'}")
    print(f"Cold Call Test: {'✅ Success' if cold_call_ok else '❌ Failed'}")

if __name__ == "__main__":
    main() 