// src/utils/helpers.js
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  export const calculatePassRate = (sessions) => {
    if (!sessions.length) return 0;
    const passedSessions = sessions.filter(s => s.calls_passed >= s.calls_attempted * 0.6);
    return Math.round((passedSessions.length / sessions.length) * 100);
  };
  
  export const getAccessLevelColor = (level) => {
    const colors = {
      UNLIMITED: 'green',
      TRIAL: 'blue',
      LIMITED: 'orange'
    };
    return colors[level] || 'gray';
  };
  
  export const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  };
  