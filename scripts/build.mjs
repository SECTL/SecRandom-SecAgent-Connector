import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
await build({ entryPoints: [path.join(root, "src", "main.mjs")], outfile: path.join(output, "main.mjs"), bundle: true, platform: "node", format: "esm", target: "node22" });
fs.cpSync(path.join(root, "skills"), path.join(output, "skills"), { recursive: true });
for (const file of ["secagent-plugin.json", "README.md"]) fs.copyFileSync(path.join(root, file), path.join(output, file));
const zip = new AdmZip();
zip.addLocalFolder(output);
zip.writeZip(path.join(output, "secrandom-0.1.0.zip"));
console.log("Created dist/secrandom-0.1.0.zip");
