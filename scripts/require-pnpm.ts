const expectedManager = 'pnpm/10.34.5';
const actualManager = process.env.npm_config_user_agent?.split(' ')[0];

if (actualManager !== expectedManager) {
    console.error('Install this project with pnpm 10.34.5: corepack pnpm install --frozen-lockfile');
    process.exit(1);
}
