// Helper to retry deadlock errors (PostgreSQL code 40P01)
async function retryOnDeadlock(fn, maxRetries = 3, delay = 100) {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      // Check if it's a deadlock error
      const isDeadlock = 
        error.code === 'P2034' || // Prisma's deadlock code
        (error.meta && error.meta.code === '40P01') ||
        error.message?.includes('40P01') ||
        error.message?.includes('deadlock');
        
      if (isDeadlock && retries < maxRetries) {
        retries++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retries - 1)));
        continue;
      }
      
      throw error;
    }
  }
}

module.exports = {
  retryOnDeadlock
};
