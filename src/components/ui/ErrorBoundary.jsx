// src/components/ui/ErrorBoundary.jsx
import React from 'react';
import logger from '../../utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    logger.error('🚨 Error Boundary caught an error:', {
      error: error.toString(),
      stack: errorInfo.componentStack,
      props: this.props
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Report error to monitoring service if available
    if (window.reportError) {
      window.reportError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isVoiceServiceError = this.state.error?.message?.toLowerCase().includes('voice') ||
                                  this.state.error?.message?.toLowerCase().includes('speech') ||
                                  this.state.error?.message?.toLowerCase().includes('audio') ||
                                  this.state.error?.message?.toLowerCase().includes('isinitialized');

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
            <div className="text-center">
              {/* Error Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>

              {/* Error Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {isVoiceServiceError ? 'Voice Service Error' : 'Something went wrong'}
              </h2>

              {/* Error Message */}
              <div className="text-gray-600 mb-6">
                {isVoiceServiceError ? (
                  <div className="space-y-2">
                    <p>There was an issue with the voice service initialization.</p>
                    <p className="text-sm">This might be due to browser compatibility or permissions.</p>
                  </div>
                ) : (
                  <p>An unexpected error occurred. Please try again.</p>
                )}
              </div>

              {/* Error Details (Development Only) */}
              {isDevelopment && this.state.error && (
                <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left">
                  <details>
                    <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                      Error Details (Development)
                    </summary>
                    <div className="text-xs font-mono text-gray-600 space-y-2">
                      <div>
                        <strong>Error:</strong> {this.state.error.toString()}
                      </div>
                      {this.state.error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="whitespace-pre-wrap mt-1 text-xs">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Retry Button */}
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  disabled={this.state.retryCount >= 3}
                >
                  {this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
                </button>

                {/* Reload Button */}
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>

                {/* Voice Service Specific Help */}
                {isVoiceServiceError && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left">
                    <h4 className="font-medium text-blue-900 mb-2">Troubleshooting Tips:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Allow microphone permissions when prompted</li>
                      <li>• Try using Chrome or Edge browser</li>
                      <li>• Check if other websites can access your microphone</li>
                      <li>• Disable browser extensions that might block audio</li>
                      <li>• Ensure you're using HTTPS (not HTTP)</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Support Info */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  If this problem persists, please contact support with the error details above.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;