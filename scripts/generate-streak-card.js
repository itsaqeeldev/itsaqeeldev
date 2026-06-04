const fs = require("fs");

const username = process.env.GITHUB_USERNAME;
const token = process.env.GH_TOKEN;

if (!username) throw new Error("Missing GITHUB_USERNAME");
if (!token) throw new Error("Missing GH_TOKEN / STATS_TOKEN");

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-streak-card",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error("GitHub GraphQL request failed");
  }

  return json.data;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

async function main() {
  const userData = await graphql(
    `
      query($login: String!) {
        user(login: $login) {
          createdAt
        }
      }
    `,
    { login: username }
  );

  const createdAt = new Date(userData.user.createdAt);
  const startYear = createdAt.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();

  const contributionsByDate = new Map();

  for (let year = startYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const data = await graphql(
      `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `,
      { login: username, from, to }
    );

    const weeks = data.user.contributionsCollection.contributionCalendar.weeks;

    for (const week of weeks) {
      for (const day of week.contributionDays) {
        contributionsByDate.set(day.date, day.contributionCount);
      }
    }
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let totalContributions = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (
    let d = new Date(Date.UTC(startYear, 0, 1));
    d <= todayUtc;
    d = addDays(d, 1)
  ) {
    const count = contributionsByDate.get(dateKey(d)) || 0;
    totalContributions += count;

    if (count > 0) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  let cursor = new Date(todayUtc);

  if ((contributionsByDate.get(dateKey(cursor)) || 0) === 0) {
    cursor = addDays(cursor, -1);
  }

  while ((contributionsByDate.get(dateKey(cursor)) || 0) > 0) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

const svg = `
<svg width="800" height="240" viewBox="0 0 800 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="800" y2="240" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0B1220"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>

    <linearGradient id="accent" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#22D3EE"/>
      <stop offset="0.5" stop-color="#60A5FA"/>
      <stop offset="1" stop-color="#A78BFA"/>
    </linearGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Main Card -->
  <rect width="800" height="240" rx="24" fill="url(#bg)"/>
  <rect x="1" y="1" width="798" height="238" rx="23" stroke="#263244"/>

  <!-- Top accent line -->
  <rect x="24" y="20" width="752" height="4" rx="2" fill="url(#accent)" filter="url(#glow)"/>

  <!-- Header -->
  <text x="400" y="52" text-anchor="middle" fill="#F8FAFC" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">
    GitHub Activity
  </text>
  <text x="400" y="74" text-anchor="middle" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="500">
    Public + private contributions
  </text>

  <!-- Stat cards -->
  <rect x="28" y="100" width="230" height="108" rx="18" fill="#0F172A"/>
  <rect x="28.5" y="100.5" width="229" height="107" rx="17.5" stroke="#1E293B"/>

  <rect x="285" y="100" width="230" height="108" rx="18" fill="#0F172A"/>
  <rect x="285.5" y="100.5" width="229" height="107" rx="17.5" stroke="#1E293B"/>

  <rect x="542" y="100" width="230" height="108" rx="18" fill="#0F172A"/>
  <rect x="542.5" y="100.5" width="229" height="107" rx="17.5" stroke="#1E293B"/>

  <!-- Small accent dots -->
  <circle cx="55" cy="124" r="5" fill="#22D3EE"/>
  <circle cx="312" cy="124" r="5" fill="#60A5FA"/>
  <circle cx="569" cy="124" r="5" fill="#A78BFA"/>

  <!-- Labels -->
  <text x="72" y="129" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600">
    Total Contributions
  </text>
  <text x="329" y="129" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600">
    Current Streak
  </text>
  <text x="586" y="129" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600">
    Longest Streak
  </text>

  <!-- Values -->
  <text x="143" y="173" text-anchor="middle" fill="#F8FAFC" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">
    ${formatNumber(totalContributions)}
  </text>

  <text x="400" y="173" text-anchor="middle" fill="#F8FAFC" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">
    ${formatNumber(currentStreak)}
  </text>

  <text x="657" y="173" text-anchor="middle" fill="#F8FAFC" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">
    ${formatNumber(longestStreak)}
  </text>

  <!-- Tiny footer -->
  <text x="400" y="222" text-anchor="middle" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="11">
    Updated automatically via GitHub Actions
  </text>
</svg>`.trim();

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/github-streak.svg", svg);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

