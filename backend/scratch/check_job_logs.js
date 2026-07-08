const supabase = require('../database/connection');

async function run() {
  const { data: jobs, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  for (const job of jobs) {
    console.log(`\n===========================================`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Provider: ${job.current_provider}`);
    console.log(`Keyword: ${job.keyword} | City: ${job.city}`);
    console.log(`Status: ${job.status}`);
    console.log(`Logs:`);
    console.log(job.logs);
  }
}

run();
