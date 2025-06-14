// src/utils/deviceDetection.js
export const deviceDetection = {
    isMobile: () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
  
    isTablet: () => {
      return /iPad|Android(?=.*\bMobile\b)/i.test(navigator.userAgent);
    },
  
    isDesktop: () => {
      return !this.isMobile() && !this.isTablet();
    },
  
    isTouchDevice: () => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
  
    getScreenSize: () => {
      return {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight
      };
    },
  
    getViewportSize: () => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    },
  
    isStandalone: () => {
      return window.matchMedia('(display-mode: standalone)').matches;
    },
  
    hasCamera: async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
      } catch {
        return false;
      }
    },
  
    hasMicrophone: async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'audioinput');
      } catch {
        return false;
      }
    },
  
    getBrowserInfo: () => {
      const ua = navigator.userAgent;
      let browser = 'Unknown';
      
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';
      
      return {
        name: browser,
        userAgent: ua,
        language: navigator.language,
        platform: navigator.platform
      };
    }
  };