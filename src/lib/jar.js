import JSZip from "jszip";
import { inferMinecraftVersion } from "./resourcePack";

const readText = async (zip, path) => (await zip.file(path)?.async("string")) ?? null;

export const readJar = async (file) => {
  const zip = await JSZip.loadAsync(file);
  const langFiles = [];
  const langFilePromises = [];

  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.match(/assets\/.*\/lang\/.*\.json$/) && !zipEntry.dir) {
      langFilePromises.push(
        zipEntry.async("string").then((content) => {
          try {
            langFiles.push({
              name: relativePath,
              sessionName: `${file.name} · ${relativePath}`,
              content: JSON.parse(content),
            });
          } catch {
            console.warn(`Could not parse ${relativePath}, skipping.`);
          }
        })
      );
    }
  });

  await Promise.all(langFilePromises);

  const modsToml =
    (await readText(zip, "META-INF/neoforge.mods.toml")) ?? (await readText(zip, "META-INF/mods.toml"));
  const fabricModJson = await readText(zip, "fabric.mod.json");
  return { langFiles, mcVersion: inferMinecraftVersion({ modsToml, fabricModJson }) };
};
