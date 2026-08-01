import { loadConfig } from '../config/load.js';
import {
  installSkills,
  writeAgentsDoc,
  writeClaudeDoc,
  writeRainmakerDoc,
  type PointerResult,
} from '../install/harness.js';

export interface InstallReport {
  installed: number;
  targets: string[];
  agents: PointerResult;
  claude: PointerResult;
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
  const claude = writeClaudeDoc(dir);
  return { installed: skills.installed, targets: skills.targets, agents, claude, rainmaker };
}

export function runInstall(): number {
  const report = installProject();
  console.log(`Installed ${report.installed} Rainmaker skills into:`);
  for (const target of report.targets) console.log(`  ${target}`);
  console.log('Wrote RAINMAKER.md.');
  for (const [name, result] of [
    ['AGENTS.md', report.agents],
    ['CLAUDE.md', report.claude],
  ] as const) {
    console.log(
      result === 'kept'
        ? `${name} already contains the Rainmaker pointer.`
        : `${result === 'written' ? 'Wrote' : 'Updated'} ${name}.`,
    );
  }
  return 0;
}
