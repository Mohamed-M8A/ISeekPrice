module.exports = function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return {
    tomorrow: tomorrow.toISOString().split('T')[0]
  };
};
