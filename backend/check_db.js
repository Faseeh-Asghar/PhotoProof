const { query } = require('./src/db');
async function test() {
  const res = await query("SELECT id, status, error_message FROM job_files WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5");
  console.log(res.rows);
  process.exit(0);
}
test();
