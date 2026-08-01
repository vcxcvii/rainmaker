import { loadConfig } from '../config/load.js';
import { installSkills, writeAgentsDoc, writeRainmakerDoc } from '../install/harness.js';

export interface InstallReport {
  installed: number;
  targets: string[];
  agents: 'written' | 'updated' | 'kept';
  rainmaker: 'written';
}

export function installProject(dir = process.cwd()): InstallReport {
  const config = loadConfig(dir);
  const input = {
    site: config.site,
    hasPrimaryConversion: config.primary_conversion.length > 0,
  };
  const skills = installSkills(dir);
  const rainmaker = writeRainmakerDoc(dir, input);
  const agents = writeAgentsDoc(dir);
  return { installed: skills.installed, targets: skills.targets, agents, rainmaker };
}

export function runInstall(): number {
  const report = installProject();
  console.log(`Installed ${report.installed} Rainmaker skills into:`);
  for (const target of report.targets) console.log(`  ${target}`);
  console.log('Wrote RAINMAKER.md.');
  console.log(
    report.agents === 'kept'
      ? 'AGENTS.md already contains the Rainmaker pointer.'
      : `${report.agents === 'written' ? 'Wrote' : 'Updated'} AGENTS.md.`,
  );
  return 0;
}
