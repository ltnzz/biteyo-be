/**
 * A lightweight, zero-dependency scheduler that schedules a task to run daily at a specific time (local timezone).
 * Uses standard JavaScript `setTimeout` and calculates the time difference dynamically.
 * 
 * @param {string} jobName Name of the job for logging
 * @param {Function} callback Async or sync function to execute
 * @param {number} hour Hour of the day (0-23)
 * @param {number} minute Minute of the hour (0-59)
 */
export const scheduleDailyJob = (jobName, callback, hour = 8, minute = 0) => {
    const run = async () => {
        console.log(`[Scheduler] [${new Date().toISOString()}] Starting job: ${jobName}`);
        try {
            await callback();
            console.log(`[Scheduler] [${new Date().toISOString()}] Job '${jobName}' completed successfully.`);
        } catch (error) {
            console.error(`[Scheduler] [${new Date().toISOString()}] Job '${jobName}' failed with error:`, error);
        }
        scheduleNext();
    };

    const scheduleNext = () => {
        const now = new Date();
        const next = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hour,
            minute,
            0,
            0
        );

        // If the scheduled time for today has already passed, schedule for tomorrow
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }

        const delay = next.getTime() - now.getTime();

        setTimeout(run, delay);

        console.log(
            `[Scheduler] Job '${jobName}' scheduled successfully. Next run: ${next.toString()} (in ${(delay / 1000 / 60 / 60).toFixed(2)} hours)`
        );
    };

    scheduleNext();
};
