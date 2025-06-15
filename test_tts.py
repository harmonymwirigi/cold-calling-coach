import os
import requests
import boto3
from dotenv import load_dotenv
import json
from datetime import datetime
from botocore.exceptions import ClientError

# Load environment variables
load_dotenv()

def test_aws_credentials():
    """Test if AWS credentials are valid using STS"""
    print("\nTesting AWS credentials with STS...")
    
    try:
        # Create STS client
        sts = boto3.client(
            'sts',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Try to get caller identity
        response = sts.get_caller_identity()
        print(f"✅ AWS credentials are valid!")
        print(f"   Account: {response['Account']}")
        print(f"   User ARN: {response['Arn']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"❌ AWS credential test failed:")
        print(f"   Error Code: {error_code}")
        print(f"   Error Message: {error_message}")
        
        if error_code == 'InvalidClientTokenId':
            print("\nTroubleshooting tips:")
            print("1. Your AWS Access Key ID is invalid or has been deactivated")
            print("2. Generate new credentials in the AWS Console")
            print("3. Make sure you're using the correct AWS account")
        elif error_code == 'SignatureDoesNotMatch':
            print("\nTroubleshooting tips:")
            print("1. Your AWS Secret Access Key is incorrect")
            print("2. Check for any extra spaces or characters in your .env file")
            print("3. Generate new credentials in the AWS Console")
        return False
    except Exception as e:
        print(f"❌ Unexpected error testing AWS credentials: {str(e)}")
        return False

def validate_aws_credentials():
    """Validate AWS credentials format"""
    print("\nValidating AWS credentials...")
    
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_region = os.getenv('AWS_REGION', 'us-east-1')
    
    if not aws_access_key:
        print("❌ AWS_ACCESS_KEY_ID is missing")
        return False
    if not aws_secret_key:
        print("❌ AWS_SECRET_ACCESS_KEY is missing")
        return False
        
    # Check credential format
    if len(aws_access_key) != 20:
        print(f"❌ AWS_ACCESS_KEY_ID appears invalid (length: {len(aws_access_key)})")
        return False
    if len(aws_secret_key) != 40:
        print(f"❌ AWS_SECRET_ACCESS_KEY appears invalid (length: {len(aws_secret_key)})")
        return False
        
    print(f"✅ AWS credentials found:")
    print(f"   Access Key: {aws_access_key[:4]}...{aws_access_key[-4:]}")
    print(f"   Secret Key: {aws_secret_key[:4]}...{aws_secret_key[-4:]}")
    print(f"   Region: {aws_region}")
    
    # Test if credentials are valid
    return test_aws_credentials()

def test_elevenlabs():
    """Test ElevenLabs TTS API"""
    print("\n=== Testing ElevenLabs ===")
    
    # Get API key from environment
    api_key = os.getenv('REACT_APP_ELEVENLABS_API_KEY')
    voice_id = os.getenv('REACT_APP_ELEVENLABS_VOICE_ID', 'EXAVITQu4vr4xnSDxMaL')
    
    if not api_key:
        print("❌ ElevenLabs API key not found in environment variables")
        return False
    
    # Test text
    test_text = "Hello! This is a test of the ElevenLabs text to speech service."
    
    try:
        # Make API request
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        data = {
            "text": test_text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        print("Making request to ElevenLabs API...")
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            # Save the audio file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"elevenlabs_test_{timestamp}.mp3"
            with open(filename, "wb") as f:
                f.write(response.content)
            print(f"✅ Success! Audio saved as {filename}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing ElevenLabs: {str(e)}")
        return False

def test_aws_polly():
    """Test AWS Polly TTS service"""
    print("\n=== Testing AWS Polly ===")
    
    # Validate credentials first
    if not validate_aws_credentials():
        return False
    
    try:
        # Initialize Polly client with explicit credentials
        polly = boto3.client(
            'polly',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Test text
        test_text = "Hello! This is a test of the AWS Polly text to speech service."
        
        print("Making request to AWS Polly...")
        response = polly.synthesize_speech(
            Text=test_text,
            OutputFormat='mp3',
            VoiceId='Joanna'  # Using Joanna as a default voice
        )
        
        # Save the audio file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"aws_polly_test_{timestamp}.mp3"
        with open(filename, "wb") as f:
            f.write(response['AudioStream'].read())
        print(f"✅ Success! Audio saved as {filename}")
        return True
        
    except Exception as e:
        print(f"❌ Error testing AWS Polly: {str(e)}")
        if "UnrecognizedClientException" in str(e):
            print("\nTroubleshooting tips:")
            print("1. Verify your AWS credentials are correct")
            print("2. Make sure your AWS account has Polly service enabled")
            print("3. Check if your IAM user has the necessary permissions")
            print("4. Verify the AWS region is correct")
        return False

def main():
    print("Starting TTS Service Tests...")
    
    # Test ElevenLabs
    elevenlabs_success = test_elevenlabs()
    
    # Test AWS Polly
    aws_success = test_aws_polly()
    
    # Print summary
    print("\n=== Test Summary ===")
    print(f"ElevenLabs: {'✅ Success' if elevenlabs_success else '❌ Failed'}")
    print(f"AWS Polly: {'✅ Success' if aws_success else '❌ Failed'}")

if __name__ == "__main__":
    main() 