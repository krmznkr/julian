// Prints the build metadata for the current environment as KEY=value lines,
// ready to append to $GITHUB_OUTPUT:  node packages/release/src/cli.ts
import { currentBuildInfo } from "./node.ts";

const info = currentBuildInfo();
process.stdout.write(`version=${info.version}\nchannel=${info.channel}\ncommit=${info.commit}\n`);
