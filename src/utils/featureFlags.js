// src/utils/featureFlags.js
export const featureFlags = {
    flags: {
      // Development flags
      ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
      ENABLE_PERFORMANCE_MONITORING: true,
      ENABLE_ERROR_TRACKING: true,
      
      // Feature flags
      ENABLE_VOICE_FEEDBACK: true,
      ENABLE_ADVANCED_ANALYTICS: true,
      ENABLE_BETA_FEATURES: false,
      ENABLE_OFFLINE_MODE: false,
      ENABLE_DARK_MODE: false,
      
      // Experimental flags
      ENABLE_AI_COACHING_V2: false,
      ENABLE_TEAM_FEATURES: false,
      ENABLE_CUSTOM_SCENARIOS: false
    },
  
    isEnabled(flagName) {
      return this.flags[flagName] || false;
    },
  
    enable(flagName) {
      this.flags[flagName] = true;
    },
  
    disable(flagName) {
      this.flags[flagName] = false;
    },
  
    // Check user-specific flags (for A/B testing)
    isEnabledForUser(flagName, userId) {
      // Implement A/B testing logic here
      // Could use hash of userId to determine bucket
      const userHash = this.hashUserId(userId);
      const buckets = {
        ENABLE_AI_COACHING_V2: userHash % 100 < 10, // 10% of users
        ENABLE_TEAM_FEATURES: userHash % 100 < 25,  // 25% of users
      };
      
      return buckets[flagName] || this.isEnabled(flagName);
    },
  
    hashUserId(userId) {
      // Simple hash function for user bucketing
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }
  };