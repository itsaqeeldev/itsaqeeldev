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
<svg width="700" height="190" viewBox="0 0 700 190" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="190" rx="18" fill="#0d1117"/>
  <rect x="1" y="1" width="698" height="188" rx="17" stroke="#30363d"/>

  <text x="350" y="38" text-anchor="middle" fill="#7DF9FF" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">
    GitHub Activity
  </text>

  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="116" y="92" text-anchor="middle" fill="#8b949e" font-size="14">Total Contributions</text>
    <text x="116" y="128" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="800">${formatNumber(totalContributions)}</text>

    <text x="350" y="92" text-anchor="middle" fill="#8b949e" font-size="14">Current Streak</text>
    <text x="350" y="128" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="800">${formatNumber(currentStreak)}</text>

    <text x="584" y="92" text-anchor="middle" fill="#8b949e" font-size="14">Longest Streak</text>
    <text x="584" y="128" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="800">${formatNumber(longestStreak)}</text>
  </g>
</svg>`.trim();

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/github-streak.svg", svg);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

