import 'dotenv/config';

const base = process.env.PHASE4_BASE_URL || 'http://localhost:8888';
const requests = Number(process.env.PHASE4_BURST_COUNT || 130);
const url = `${base}/.netlify/functions/users?role=coach&limit=24&offset=0&include_total=1&q=test`;

const statuses = [];
for (let index = 0; index < requests; index += 1) {
  const response = await fetch(url);
  statuses.push(response.status);
}

const summary = statuses.reduce((acc, status) => {
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  endpoint: url,
  total_requests: requests,
  summary,
  saw_429: statuses.includes(429)
}, null, 2));
