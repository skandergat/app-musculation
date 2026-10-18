const fs = require('node:fs');

const reportPath = 'audit-report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const vulnerabilities = report.vulnerabilities || {};

for (const [name, item] of Object.entries(vulnerabilities)) {
  const advisories = (item.via || [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      return [entry.title, entry.range, entry.url].filter(Boolean).join(' | ');
    })
    .join('; ');

  console.log(
    [
      name,
      item.severity,
      'direct=' + item.isDirect,
      'range=' + item.range,
      'fix=' + JSON.stringify(item.fixAvailable),
      'advisories=' + advisories,
    ].join(' | '),
  );
}

console.log(
  'Audit totals:',
  JSON.stringify(report.metadata?.vulnerabilities || {}),
);
