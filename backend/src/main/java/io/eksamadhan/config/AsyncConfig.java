package io.eksamadhan.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Two pools, because answering a customer and tidying up behind them are not the same job.
 *
 * They were one pool, and the consequence was that a customer's reply queued behind whatever
 * housekeeping happened to be running — a website crawl walks 25 pages with a politeness delay
 * between each, and it held a worker the whole time. Separating them means the slow, bulky work
 * can never make someone wait for an answer.
 *
 * A note on sizing, because it is the part that surprises people: a {@link ThreadPoolTaskExecutor}
 * only creates threads beyond its core size once the <em>queue is full</em>. The old settings —
 * core 2, max 5, queue 100 — therefore never ran more than two things at once, whatever the max
 * said. Core size is the real concurrency; the queue is only a buffer for bursts.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * The customer-facing path: reading a message, answering it, sending the reply.
     *
     * Sized for conversations in flight rather than for CPU. These threads spend nearly all
     * their time waiting on a network call — retrieval, the model, Meta — so more of them cost
     * little and let unrelated conversations proceed side by side.
     */
    @Bean(name = "replyExecutor")
    public Executor replyExecutor(@Value("${app.async.reply-threads:6}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("reply-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);

        // Under a burst beyond the queue, the caller does the work itself rather than dropping
        // it. Slower for that one caller, and nobody's message goes unanswered.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    /**
     * Everything nobody is waiting on: history sync, crawling, indexing, backfills, push.
     *
     * Kept deliberately narrow. These jobs are bulky and it does not matter if they take a
     * minute longer, whereas letting them loose would mean competing with replies for the one
     * resource that actually serialises — the model.
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor(@Value("${app.async.background-threads:3}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }
}
