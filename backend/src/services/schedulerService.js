import cron from 'node-cron';
import trackingService from './trackingService.js';

/**
 * Scheduler Service - Automated price updates using cron jobs
 */
class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🕐 Starting scheduler service...');

    // Schedule 1: Update all prices every 6 hours (default)
    const priceUpdateSchedule = process.env.PRICE_UPDATE_SCHEDULE || '0 */6 * * *';
    this.scheduleJob('priceUpdate', priceUpdateSchedule, async () => {
      console.log('🔄 Running scheduled price update...');
      try {
        await trackingService.updateAllPrices();
        console.log('✅ Scheduled price update completed');
      } catch (error) {
        console.error('❌ Scheduled price update failed:', error);
      }
    });

    // Schedule 2: Clean up old cache every day at midnight
    this.scheduleJob('cacheCleanup', '0 0 * * *', async () => {
      console.log('🧹 Running cache cleanup...');
      try {
        // You can implement cache cleanup logic here
        console.log('✅ Cache cleanup completed');
      } catch (error) {
        console.error('❌ Cache cleanup failed:', error);
      }
    });

    this.isRunning = true;
    console.log('✅ Scheduler service started');
    this.listJobs();
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('⏹️ Stopping scheduler service...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`  Stopped job: ${name}`);
    });
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Scheduler service stopped');
  }

  /**
   * Schedule a new job
   */
  scheduleJob(name, schedule, task) {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    // Stop existing job with same name if it exists
    if (this.jobs.has(name)) {
      this.jobs.get(name).stop();
    }

    // Create and start new job
    const job = cron.schedule(schedule, task, {
      scheduled: true,
      timezone: 'Asia/Kolkata', // Indian timezone
    });

    this.jobs.set(name, job);
    console.log(`📅 Scheduled job: ${name} (${schedule})`);

    return job;
  }

  /**
   * Get a specific job
   */
  getJob(name) {
    return this.jobs.get(name);
  }

  /**
   * Remove a job
   */
  removeJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`🗑️ Removed job: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * List all scheduled jobs
   */
  listJobs() {
    console.log(`📋 Active scheduled jobs: ${this.jobs.size}`);
    this.jobs.forEach((job, name) => {
      console.log(`  - ${name}`);
    });
  }

  /**
   * Manually trigger price update
   */
  async triggerPriceUpdate() {
    console.log('🔄 Manually triggering price update...');
    try {
      const results = await trackingService.updateAllPrices();
      console.log('✅ Manual price update completed');
      return results;
    } catch (error) {
      console.error('❌ Manual price update failed:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.isRunning,
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys()),
    };
  }
}

export default new SchedulerService();
